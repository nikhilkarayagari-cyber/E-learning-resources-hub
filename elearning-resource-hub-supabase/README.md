# E-Learning Resource Hub — Supabase + Netlify

This project keeps the original responsive HTML/CSS/JS interface and connects it to Supabase for real authentication, courses, enrollments, progress, and file storage. Netlify hosts the static frontend; Supabase is the backend.

## 1. Create/configure Supabase
1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor**, create a new query, paste all of `supabase/setup.sql`, and run it. It creates the schema, RLS policies, `course-assets` Storage bucket, and eight sample courses.
3. In **Project Settings → API / Connect**, copy the **Project URL** and the **publishable key** (`sb_publishable_...`) or legacy `anon` key. Do not use `service_role` or any secret key in browser code.
4. `public/supabase-config.js` is preconfigured with the Supabase URL and publishable key you provided. This file intentionally contains only browser-safe public values.
5. In **Authentication → URL Configuration**, set Site URL to your Netlify URL after deployment. Add your Netlify URL and `http://localhost:8888` (for local Netlify CLI) to Redirect URLs if using password reset.
6. For simpler testing, you can disable email confirmation temporarily under Authentication settings; for a real public site, keep confirmation enabled and configure SMTP.

## 2. Admin access
The SQL trigger assigns the admin role only when a newly registered account's email matches `257r1a6629genai@gmail.com`. Register using that exact email. If the account already existed before running the SQL, run this once in SQL Editor to promote that specific account:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = '257r1a6629genai@gmail.com';
```

Do not expose an interface that lets users edit their own role. RLS policies use `public.is_admin()` for course changes and Storage uploads.

## 3. Deploy to Netlify
1. Push the folder to a GitHub repository, or deploy manually from the extracted project.
2. For Git deployment, choose the project root as the base directory and set the publish directory to `public`; `netlify.toml` already configures this. No build command is required.
3. For manual deployment, drag the **contents of the `public` folder** into Netlify Drop. To keep project SQL and documentation, preferably connect the whole project through GitHub.
4. Set Supabase Auth Site URL/redirect allowlist to the resulting `https://your-site.netlify.app` URL.

## 4. Local preview
Open `public/index.html` through a local static server (not `file://`). For example, install Node.js and run:

```bash
npx serve public
```

Open the URL printed by `serve`. `npm start` is retained only for the old local Express demo; the Supabase/Netlify build does not need Express.

## Database objects
- `profiles`: user profile and role
- `courses`: catalog records
- `enrollments`: user/course link and progress percentage
- `lessons`: lesson metadata and links
- `lesson_completions`: lesson completion tracking
- Storage bucket `course-assets`: public reads, admin-only uploads/updates/deletes

## Notes / current scope
- Authentication is email/password with password reset. Google OAuth is not enabled.
- Course list, enrollments, progress, course create/delete and role checks use Supabase.
- Storage bucket and policies are configured; the existing interface does not yet expose a dedicated file-upload form. Add one if you need admin upload controls in the UI.
- Student counts/ratings are seeded display metrics, not live analytics.
- Never commit a Supabase service-role key. The browser only uses the publishable/anon key and relies on RLS.
