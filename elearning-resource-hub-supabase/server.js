const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const seed = {
  courses: [
    { id: 1, title: "Web Development Bootcamp", category: "Development", level: "Beginner", instructor: "Aarav Mehta", duration: "8h 20m", lessons: 32, rating: 4.9, students: 2840, price: "Free", color: "violet", icon: "⌘", description: "Build responsive websites from the ground up with HTML, CSS, JavaScript and practical projects.", tags: ["HTML", "CSS", "JavaScript"], featured: true },
    { id: 2, title: "UI/UX Design Essentials", category: "Design", level: "Beginner", instructor: "Maya Kapoor", duration: "5h 45m", lessons: 24, rating: 4.8, students: 1960, price: "Free", color: "orange", icon: "✳", description: "Learn user research, wireframes, visual hierarchy and polished interface design.", tags: ["Figma", "Research", "Prototyping"], featured: true },
    { id: 3, title: "Python for Data Analysis", category: "Data Science", level: "Intermediate", instructor: "Rohan Iyer", duration: "10h 10m", lessons: 41, rating: 4.9, students: 3210, price: "Free", color: "blue", icon: "⌁", description: "Explore datasets, clean data and discover insights using Python, Pandas and charts.", tags: ["Python", "Pandas", "Charts"], featured: true },
    { id: 4, title: "Digital Marketing Strategy", category: "Business", level: "Beginner", instructor: "Nisha Rao", duration: "4h 30m", lessons: 18, rating: 4.7, students: 1480, price: "Free", color: "green", icon: "↗", description: "Create practical campaigns with content strategy, SEO, analytics and social media.", tags: ["SEO", "Content", "Analytics"], featured: false },
    { id: 5, title: "Java Programming Masterclass", category: "Development", level: "Intermediate", instructor: "Kabir Shah", duration: "9h 05m", lessons: 36, rating: 4.8, students: 2540, price: "Free", color: "pink", icon: "{ }", description: "Strengthen object-oriented programming skills and build console-based Java projects.", tags: ["Java", "OOP", "Projects"], featured: false },
    { id: 6, title: "Excel & Data Visualization", category: "Data Science", level: "Beginner", instructor: "Priya Nair", duration: "3h 50m", lessons: 16, rating: 4.6, students: 1120, price: "Free", color: "teal", icon: "▦", description: "Turn everyday spreadsheets into clear reports with formulas, pivots and charts.", tags: ["Excel", "Reports", "Charts"], featured: false },
    { id: 7, title: "Productivity with AI Tools", category: "Business", level: "Beginner", instructor: "Dev Malhotra", duration: "2h 40m", lessons: 12, rating: 4.7, students: 980, price: "Free", color: "violet", icon: "✧", description: "Use AI thoughtfully to brainstorm, research, plan tasks and improve workflows.", tags: ["AI", "Workflow", "Prompts"], featured: false },
    { id: 8, title: "Graphic Design Foundations", category: "Design", level: "Beginner", instructor: "Ananya Bose", duration: "6h 15m", lessons: 27, rating: 4.8, students: 1720, price: "Free", color: "orange", icon: "◈", description: "Practice typography, color theory, composition and visual storytelling.", tags: ["Typography", "Color", "Layout"], featured: false }
  ],
  students: [
    { id: "STU-1042", name: "Alex Johnson", email: "alex@example.com", enrolled: [1, 2, 3], progress: { "1": 68, "2": 35, "3": 12 } },
    { id: "STU-1043", name: "Sam Taylor", email: "sam@example.com", enrolled: [2, 5], progress: { "2": 74, "5": 42 } },
    { id: "STU-1044", name: "Jordan Lee", email: "jordan@example.com", enrolled: [1, 4, 6], progress: { "1": 91, "4": 58, "6": 25 } }
  ]
};

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error("Could not read data file:", err);
    return JSON.parse(JSON.stringify(seed));
  }
}
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "E-Learning Resource Hub" }));
app.get("/api/courses", (req, res) => {
  const data = readData();
  let courses = data.courses;
  const q = String(req.query.q || "").toLowerCase().trim();
  const category = String(req.query.category || "All");
  if (q) courses = courses.filter(c => [c.title, c.category, c.instructor, c.description, ...(c.tags || [])].join(" ").toLowerCase().includes(q));
  if (category !== "All") courses = courses.filter(c => c.category === category);
  res.json(courses);
});
app.get("/api/students", (req, res) => res.json(readData().students));
app.get("/api/students/:id", (req, res) => {
  const student = readData().students.find(s => s.id === req.params.id || s.email === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});
app.post("/api/enroll", (req, res) => {
  const { studentId = "STU-1042", courseId } = req.body || {};
  const data = readData();
  const student = data.students.find(s => s.id === studentId);
  const course = data.courses.find(c => c.id === Number(courseId));
  if (!student || !course) return res.status(404).json({ error: "Student or course not found" });
  if (!student.enrolled.includes(course.id)) student.enrolled.push(course.id);
  if (student.progress[String(course.id)] == null) student.progress[String(course.id)] = 0;
  writeData(data);
  res.json({ message: "Enrolled successfully", student, course });
});
app.patch("/api/progress", (req, res) => {
  const { studentId = "STU-1042", courseId, progress } = req.body || {};
  const data = readData();
  const student = data.students.find(s => s.id === studentId);
  if (!student || !student.enrolled.includes(Number(courseId))) return res.status(404).json({ error: "Enrollment not found" });
  student.progress[String(courseId)] = Math.max(0, Math.min(100, Number(progress) || 0));
  writeData(data);
  res.json({ message: "Progress updated", progress: student.progress[String(courseId)] });
});
app.post("/api/courses", (req, res) => {
  const { title, category, instructor, level, duration, description } = req.body || {};
  if (![title, category, instructor, level, duration, description].every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ error: "Please fill in all course fields." });
  }
  const data = readData();
  const course = {
    id: Math.max(0, ...data.courses.map(c => c.id)) + 1,
    title: title.trim(), category: category.trim(), instructor: instructor.trim(),
    level: level.trim(), duration: duration.trim(), lessons: 12, rating: 4.7, students: 0,
    price: "Free", color: ["violet", "orange", "blue", "green"][data.courses.length % 4],
    icon: "✦", description: description.trim(), tags: [category.trim(), level.trim()], featured: false
  };
  data.courses.unshift(course);
  writeData(data);
  res.status(201).json(course);
});
app.delete("/api/courses/:id", (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const exists = data.courses.some(c => c.id === id);
  if (!exists) return res.status(404).json({ error: "Course not found" });
  data.courses = data.courses.filter(c => c.id !== id);
  data.students.forEach(s => {
    s.enrolled = s.enrolled.filter(courseId => courseId !== id);
    delete s.progress[String(id)];
  });
  writeData(data);
  res.json({ message: "Course deleted" });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`E-Learning Resource Hub running at http://localhost:${PORT}`));
