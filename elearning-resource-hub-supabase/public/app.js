const STUDENT_ID = null;
let courses = [];
let student = { id: null, email: '', name: 'Learner', role: 'student', enrolled: [], progress: {} };
let currentView = 'overview';
let toastTimer;
let authMode = 'login';
let supabaseClient = null;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function requireClient() {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey || cfg.url.includes('YOUR_SUPABASE') || cfg.anonKey.includes('YOUR_SUPABASE')) {
    throw new Error('Add your Supabase Project URL and publishable/anon key in public/supabase-config.js, then reload.');
  }
  if (!supabaseClient) supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  return supabaseClient;
}
async function refreshData() {
  const sb = requireClient();
  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) { showAuthGate(true); return; }
  const user = authData.user;
  const { data: profile, error: profileError } = await sb.from('profiles').select('id,email,full_name,role').eq('id', user.id).single();
  if (profileError) throw profileError;
  student = { id: user.id, email: user.email, name: profile.full_name || user.email.split('@')[0], role: profile.role || 'student', enrolled: [], progress: {} };
  const [{ data: courseRows, error: courseError }, { data: enrollmentRows, error: enrollmentError }] = await Promise.all([
    sb.from('courses').select('*').order('created_at', { ascending: false }),
    sb.from('enrollments').select('course_id,progress').eq('user_id', user.id)
  ]);
  if (courseError) throw courseError;
  if (enrollmentError) throw enrollmentError;
  courses = (courseRows || []).map(c => ({ ...c, id: Number(c.id), lessons: Number(c.lessons || 0), rating: Number(c.rating || 0), students: Number(c.students || 0), tags: c.tags || [], featured: Boolean(c.featured) }));
  (enrollmentRows || []).forEach(e => { student.enrolled.push(Number(e.course_id)); student.progress[String(e.course_id)] = Number(e.progress || 0); });
  const name = student.name || 'Learner';
  if ($('#profileName')) $('#profileName').textContent = name;
  if ($('#profileRole')) $('#profileRole').textContent = student.role === 'admin' ? 'Administrator' : 'Student account';
  if ($('.top-avatar')) $('.top-avatar').textContent = name.split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
  if ($('.profile-mini .avatar')) $('.profile-mini .avatar').textContent = name.split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
  if ($('.profile-mini .profile-info strong')) $('.profile-mini .profile-info strong').textContent = name;
  if ($('.profile-mini .profile-info span')) $('.profile-mini .profile-info span').textContent = student.role === 'admin' ? 'Administrator' : 'Student';
  const adminNav = $('[data-view="admin"]');
  if (adminNav) adminNav.style.display = student.role === 'admin' ? '' : 'none';
  const adminView = $('#view-admin');
  if (adminView && student.role !== 'admin' && currentView === 'admin') navigate('overview');
  showAuthGate(false);
  renderAll();
}
async function request(url, options = {}) {
  const sb = requireClient();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const match = url.match(/^\/api\/courses(?:\/(\d+))?$/);
  if (url === '/api/courses' && method === 'GET') {
    const { data, error } = await sb.from('courses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(c => ({ ...c, id: Number(c.id), lessons: Number(c.lessons || 0), rating: Number(c.rating || 0), students: Number(c.students || 0), tags: c.tags || [] }));
  }
  if (match && method === 'DELETE') { const { error } = await sb.from('courses').delete().eq('id', Number(match[1])); if (error) throw error; return { ok: true }; }
  if (url === '/api/courses' && method === 'POST') {
    if (student.role !== 'admin') throw new Error('Only the configured administrator can publish courses.');
    const colors = ['violet','orange','blue','green','pink','teal'];
    const payload = { ...body, lessons: 12, rating: 4.7, students: 0, price: 'Free', color: colors[courses.length % colors.length], icon: '✦', tags: [body.category, body.level], featured: false, created_by: student.id };
    const { data, error } = await sb.from('courses').insert(payload).select('*').single();
    if (error) throw error;
    return { ...data, id: Number(data.id), tags: data.tags || [] };
  }
  if (url === '/api/enroll' && method === 'POST') {
    const courseId = Number(body.courseId);
    const { error } = await sb.from('enrollments').upsert({ user_id: student.id, course_id: courseId, progress: student.progress[String(courseId)] || 0 }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
    if (error) throw error;
    return { message: 'Enrolled successfully' };
  }
  if (url === '/api/progress' && method === 'PATCH') {
    const courseId = Number(body.courseId); const progress = Math.max(0, Math.min(100, Number(body.progress) || 0));
    const { error } = await sb.from('enrollments').update({ progress, updated_at: new Date().toISOString() }).eq('user_id', student.id).eq('course_id', courseId);
    if (error) throw error;
    return { message: 'Progress updated', progress };
  }
  throw new Error('Unsupported API action: ' + url);
}
function showAuthGate(show) { const gate = $('#authGate'); if (gate) gate.style.display = show ? 'flex' : 'none'; if (show) $('#authMessage').textContent = $('#authMessage').textContent || 'Connect Supabase and sign in or create an account.'; }
function setAuthMode(mode) {
  authMode = mode;
  $('#authName').parentElement.style.display = mode === 'signup' ? 'grid' : 'none';
  $('#authSubmit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  $('#authLoginTab').className = mode === 'login' ? 'button button-primary' : 'button button-outline';
  $('#authSignupTab').className = mode === 'signup' ? 'button button-primary' : 'button button-outline';
  $('#authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#authMessage').textContent = mode === 'signup' ? 'Use your real email. Supabase may send a verification link.' : '';
}
$('#authLoginTab').addEventListener('click', () => setAuthMode('login'));
$('#authSignupTab').addEventListener('click', () => setAuthMode('signup'));
$('#authReset').addEventListener('click', async () => {
  try { const sb = requireClient(); const email = $('#authEmail').value.trim(); if (!email) throw new Error('Enter your email first.'); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); if (error) throw error; $('#authMessage').textContent = 'Password reset email sent if this account exists.'; }
  catch (e) { $('#authMessage').textContent = e.message; }
});
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault(); const msg = $('#authMessage'); const button = $('#authSubmit'); button.disabled = true; msg.textContent = 'Please wait…';
  try {
    const sb = requireClient(); const email = $('#authEmail').value.trim().toLowerCase(); const password = $('#authPassword').value;
    if (authMode === 'signup') {
      const full_name = $('#authName').value.trim(); if (!full_name) throw new Error('Enter your full name.');
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name } } }); if (error) throw error;
      if (!data.session) { msg.textContent = 'Account created. Check your email to confirm, then sign in.'; setAuthMode('login'); }
      else { msg.textContent = 'Account created. Loading your workspace…'; await refreshData(); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; await refreshData(); msg.textContent = '';
    }
  } catch (err) { msg.textContent = err.message || 'Authentication failed.'; }
  finally { button.disabled = false; }
});
function showToast(message) {
  $("#toastMessage").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function progressFor(courseId) { return Number(student?.progress?.[String(courseId)] || 0); }
function enrolledCourses() { return (student?.enrolled || []).map(id => courses.find(c => c.id === id)).filter(Boolean); }
function courseThumb(course, extra = "") {
  return `<div class="course-thumb ${escapeHTML(course.color)} ${extra}"><span>${escapeHTML(course.icon)}</span></div>`;
}
function courseCard(course) {
  const enrolled = student?.enrolled?.includes(course.id);
  return `<article class="course-card" data-open-course="${course.id}" tabindex="0" role="button" aria-label="View ${escapeHTML(course.title)}">
    <div class="course-cover ${escapeHTML(course.color)}"><span class="cover-label">${escapeHTML(course.category)}</span><button class="bookmark" data-bookmark="${course.id}" aria-label="Save course" title="Save course">♡</button><span class="cover-orbit"></span><span class="cover-orbit two"></span><span class="cover-symbol">${escapeHTML(course.icon)}</span></div>
    <div class="course-card-body"><div class="course-card-meta"><span>${escapeHTML(course.level)}</span><span class="rating">★ ${Number(course.rating).toFixed(1)}</span></div>
    <h3>${escapeHTML(course.title)}</h3><div class="instructor-line"><span class="instructor-dot">${escapeHTML(course.instructor.split(" ").map(n=>n[0]).join("").slice(0,2))}</span>${escapeHTML(course.instructor)} <span>·</span> ${escapeHTML(course.duration)}</div>
    <div class="course-card-footer"><span class="course-price">${escapeHTML(course.price)} <small>· ${course.lessons} lessons</small></span><button class="enroll-mini" data-enroll="${course.id}">${enrolled ? "Continue →" : "View course ↗"}</button></div></div></article>`;
}
function continueCard(course) {
  const progress = progressFor(course.id);
  return `<article class="continue-card">${courseThumb(course)}<div class="continue-details"><span class="course-category">${escapeHTML(course.category)}</span><h3>${escapeHTML(course.title)}</h3><div class="course-meta"><span>▤ ${course.lessons} lessons</span><span>◷ ${escapeHTML(course.duration)}</span></div><div class="progress-line"><i class="${progress === 100 ? "green-progress" : ""}" style="width:${progress}%"></i></div></div><div class="continue-end"><span class="progress-label">${progress}%</span><button class="circle-play" data-learn="${course.id}" aria-label="Continue ${escapeHTML(course.title)}">▶</button></div></article>`;
}
function learningCourse(course) {
  const progress = progressFor(course.id);
  return `<article class="learning-course">${courseThumb(course)}<div class="learning-course-main"><span class="course-category">${escapeHTML(course.category)} · ${escapeHTML(course.level)}</span><h3>${escapeHTML(course.title)}</h3><p class="muted">By ${escapeHTML(course.instructor)} · ${course.lessons} lessons · ${escapeHTML(course.duration)}</p></div><div class="learning-progress"><div><span class="muted">Course progress</span><strong>${progress}%</strong></div><div class="progress-line"><i class="${progress === 100 ? "green-progress" : ""}" style="width:${progress}%"></i></div></div><button class="button button-outline" data-learn="${course.id}">${progress === 100 ? "Review course" : "Continue →"}</button></article>`;
}
function renderOverview() {
  const enrolled = enrolledCourses();
  $("#continueList").innerHTML = enrolled.slice(0, 3).map(continueCard).join("") || `<div class="panel"><p class="muted">You haven't enrolled in a course yet. Explore the catalog to get started.</p><button class="button button-primary" data-go="courses">Explore courses</button></div>`;
  $("#featuredCourses").innerHTML = courses.filter(c => c.featured).slice(0, 4).map(courseCard).join("");
  $("#statEnrolled").textContent = enrolled.length;
  $("#statCompleted").textContent = enrolled.filter(c => progressFor(c.id) === 100).length;
}
function renderCourses() {
  const query = $("#courseSearch").value.toLowerCase().trim();
  const category = $("#categoryFilter").value;
  const level = $("#levelFilter").value;
  const filtered = courses.filter(c => {
    const matchesQuery = [c.title, c.category, c.instructor, c.description, ...(c.tags || [])].join(" ").toLowerCase().includes(query);
    return matchesQuery && (category === "All" || c.category === category) && (level === "All" || c.level === level);
  });
  $("#allCourses").innerHTML = filtered.map(courseCard).join("");
  $("#courseTotal").textContent = filtered.length;
  $("#courseCountNav").textContent = courses.length;
  $("#emptyCourses").classList.toggle("hidden", filtered.length > 0);
  $$("#categoryChips .chip").forEach(chip => chip.classList.toggle("active", chip.dataset.category === category));
  $$("#categoryChips .chip").forEach(chip => {
    const count = courses.filter(c => chip.dataset.category === "All" || c.category === chip.dataset.category).length;
    if (chip.dataset.category === "All") chip.innerHTML = `All courses <span>${count}</span>`;
  });
}
function renderDashboard() {
  const enrolled = enrolledCourses();
  const complete = enrolled.filter(c => progressFor(c.id) === 100).length;
  const average = enrolled.length ? Math.round(enrolled.reduce((sum, c) => sum + progressFor(c.id), 0) / enrolled.length) : 0;
  $("#dashEnrolled").textContent = enrolled.length;
  $("#dashCompleted").textContent = complete;
  $("#dashAverage").textContent = `${average}%`;
  $("#learningCourses").innerHTML = enrolled.map(learningCourse).join("") || `<div class="panel empty-learning"><h3>Your learning journey starts here</h3><p class="muted">Enroll in a course to see it in your dashboard.</p><button class="button button-primary" data-go="courses">Browse courses</button></div>`;
}
function renderAdmin() {
  if (student.role !== "admin") { $("#adminCoursesCount").textContent = "—"; $("#adminStudentsCount").textContent = "—"; $("#adminCategoriesCount").textContent = "—"; $("#adminCourseList").innerHTML = "<p class=\"muted\">Administrator access required.</p>"; return; }
  const categories = new Set(courses.map(c => c.category));
  $("#adminCoursesCount").textContent = courses.length;
  $("#adminStudentsCount").textContent = "3";
  $("#adminCategoriesCount").textContent = categories.size;
  $("#libraryCount").textContent = `${courses.length} items`;
  $("#adminCourseList").innerHTML = courses.map(c => `<div class="admin-course-row">${courseThumb(c)}<div class="admin-course-info"><strong>${escapeHTML(c.title)}</strong><span>${escapeHTML(c.category)} · ${escapeHTML(c.level)} · ${c.lessons} lessons</span></div><button class="delete-course" data-delete-course="${c.id}" title="Delete course" aria-label="Delete ${escapeHTML(c.title)}">×</button></div>`).join("") || `<p class="muted">No courses yet. Add your first course using the form.</p>`;
}
function renderAll() {
  renderOverview(); renderCourses(); renderDashboard(); renderAdmin();
}
function navigate(view) {
  if (!["overview", "courses", "dashboard", "admin"].includes(view)) return;
  currentView = view;
  $$(".view").forEach(el => el.classList.toggle("active-view", el.id === `view-${view}`));
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $("#pageName").textContent = ({ overview: "Overview", courses: "Explore courses", dashboard: "My learning", admin: "Admin studio" })[view];
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "courses") $("#courseSearch").focus({ preventScroll: true });
}
function openCourse(courseId) {
  const course = courses.find(c => c.id === Number(courseId));
  if (!course) return;
  const enrolled = (student.enrolled || []).includes(course.id);
  const progress = progressFor(course.id);
  $("#modalBody").innerHTML = `<div class="modal-hero course-cover ${escapeHTML(course.color)}"><span class="cover-orbit"></span><span class="cover-orbit two"></span><span class="cover-symbol">${escapeHTML(course.icon)}</span></div><span class="course-category">${escapeHTML(course.category)} · ${escapeHTML(course.level)}</span><h2 id="modalTitle">${escapeHTML(course.title)}</h2><p class="modal-description">${escapeHTML(course.description)}</p><div class="modal-tags">${(course.tags || []).map(t => `<span>${escapeHTML(t)}</span>`).join("")}</div><div class="modal-facts"><span>★ <strong>${Number(course.rating).toFixed(1)}</strong> rating</span><span>◷ <strong>${escapeHTML(course.duration)}</strong></span><span>▤ <strong>${course.lessons}</strong> lessons</span><span>♧ <strong>${Number(course.students).toLocaleString()}</strong> learners</span></div>${enrolled ? `<div class="modal-enrolled">✓ You're enrolled · ${progress}% complete</div><button class="button button-primary full-width" style="margin-top:12px" data-learn="${course.id}">${progress === 100 ? "Review course" : "Continue learning"} →</button>` : `<button class="button button-primary full-width" data-enroll="${course.id}">Enroll for free →</button>`}`;
  $("#courseModal").classList.remove("hidden");
}
function closeModal() { $("#courseModal").classList.add("hidden"); }
async function enroll(courseId) {
  try {
    await request(`${API}/enroll`, { method: "POST", body: JSON.stringify({ studentId: STUDENT_ID, courseId: Number(courseId) }) });
    await refreshData();
    closeModal();
    showToast("You're enrolled! Your learning journey starts now.");
    navigate("dashboard");
  } catch (err) { showToast(err.message); }
}
async function startLearning(courseId) {
  const course = courses.find(c => c.id === Number(courseId));
  if (!course) return;
  if (!(student.enrolled || []).includes(course.id)) return enroll(course.id);
  const old = progressFor(course.id);
  const next = old >= 100 ? 100 : Math.min(100, old + 10);
  if (next === old) {
    openCourse(course.id);
    showToast("Course completed — well done!");
    return;
  }
  try {
    await request(`${API}/progress`, { method: "PATCH", body: JSON.stringify({ studentId: STUDENT_ID, courseId: course.id, progress: next }) });
    await refreshData();
    showToast(next === 100 ? "Course completed! Congratulations 🎉" : `Progress updated to ${next}% — keep going!`);
    if (currentView !== "dashboard") navigate("dashboard");
  } catch (err) { showToast(err.message); }
}
function syncSearch(value) {
  $("#courseSearch").value = value;
  $("#categoryFilter").value = "All";
  $("#levelFilter").value = "All";
  navigate("courses");
  renderCourses();
}
document.addEventListener("click", async event => {
  const go = event.target.closest("[data-go]");
  if (go) return navigate(go.dataset.go);
  const nav = event.target.closest("[data-view]");
  if (nav) return navigate(nav.dataset.view);
  const enrollButton = event.target.closest("[data-enroll]");
  if (enrollButton) { event.stopPropagation(); return enroll(enrollButton.dataset.enroll); }
  const learnButton = event.target.closest("[data-learn]");
  if (learnButton) { event.stopPropagation(); closeModal(); return startLearning(learnButton.dataset.learn); }
  const course = event.target.closest("[data-open-course]");
  if (course && !event.target.closest("[data-bookmark]")) return openCourse(course.dataset.openCourse);
  const bookmark = event.target.closest("[data-bookmark]");
  if (bookmark) { event.stopPropagation(); bookmark.textContent = bookmark.textContent === "♡" ? "♥" : "♡"; showToast(bookmark.textContent === "♥" ? "Course saved to your demo wishlist." : "Removed from saved courses."); }
  const del = event.target.closest("[data-delete-course]");
  if (del) {
    const target = courses.find(c => c.id === Number(del.dataset.deleteCourse));
    if (student.role !== "admin") return showToast("Administrator access required.");
    if (!target || !confirm(`Delete "${target.title}" from the course catalog?`)) return;
    try { await request(`${API}/courses/${target.id}`, { method: "DELETE" }); await refreshData(); showToast("Course removed from the catalog."); }
    catch (err) { showToast(err.message); }
  }
  const resource = event.target.closest("[data-resource]");
  if (resource) showToast(`${resource.dataset.resource}: sample resource preview coming soon.`);
});
document.addEventListener("keydown", event => {
  const card = event.target.closest("[data-open-course]");
  if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openCourse(card.dataset.openCourse); }
  if (event.key === "Escape") closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#globalSearch").focus(); }
});
$("#globalSearch").addEventListener("input", event => syncSearch(event.target.value));
$("#courseSearch").addEventListener("input", renderCourses);
$("#categoryFilter").addEventListener("change", renderCourses);
$("#levelFilter").addEventListener("change", renderCourses);
$("#categoryChips").addEventListener("click", event => {
  const chip = event.target.closest("[data-category]");
  if (!chip) return;
  $("#categoryFilter").value = chip.dataset.category;
  renderCourses();
});
$("#clearFilters").addEventListener("click", () => {
  $("#courseSearch").value = ""; $("#categoryFilter").value = "All"; $("#levelFilter").value = "All"; renderCourses();
});
$("#modalClose").addEventListener("click", closeModal);
$("#courseModal").addEventListener("click", event => { if (event.target.id === "courseModal") closeModal(); });
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#goLearning").addEventListener("click", () => navigate("dashboard"));
$("#notificationButton").addEventListener("click", () => showToast("You're all caught up — no new notifications."));
$("#addCourseForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (student.role !== "admin") { showToast("Administrator access required."); return; }
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const course = await request(`${API}/courses`, { method: "POST", body: JSON.stringify(values) });
    form.reset();
    await refreshData();
    showToast(`"${course.title}" published to the course catalog.`);
    navigate("courses");
  } catch (err) { showToast(err.message); }
});
(async function boot() {
  setAuthMode('login');
  try {
    const sb = requireClient();
    const { data: { session } } = await sb.auth.getSession();
    if (session) await refreshData(); else { showAuthGate(true); $('#authMessage').textContent = 'Sign in or create an account to access the learning hub.'; }
    sb.auth.onAuthStateChange((_event, sessionNow) => { if (sessionNow) refreshData().catch(err => showToast(err.message)); else showAuthGate(true); });
  } catch (err) { showAuthGate(true); $('#authMessage').textContent = err.message; console.error(err); }
})();
