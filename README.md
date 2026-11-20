# RoboParty 2026

React + TypeScript + Vite + Supabase. Hash routing, so refreshes and direct links work on GitHub Pages.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor: paste and run `supabase/schema.sql`.
3. Authentication > Users > Add user (email + password) for yourself and each judge.
4. SQL Editor, make yourself admin (use your user's id from the Users list):
   `insert into staff(user_id, role) values ('YOUR-USER-ID','admin');`
   Judges: `insert into staff values ('JUDGE-ID','judge');` then
   `insert into judge_assignments select 'JUDGE-ID', id from activities where name = 'Robot Race';`
5. Log in on the site as admin and add students with the Add student form (no CSV needed).
6. Settings > API: copy the Project URL and the anon public key. Never use the service_role key in this app.

## 2. Run locally
`cp .env.example .env`, fill both values, then `npm install && npm run dev`.

## 3. GitHub Pages
1. Push this folder to a GitHub repo (branch `main`).
2. Settings > Secrets and variables > Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Settings > Pages > Source: GitHub Actions. Push to deploy.

Pages: `#/` home, `#/grade/2..5`, `#/lower`, `#/upper`, `#/winners`, `#/display` (projector), `#/judge` (login and score entry).

## Not built yet (use the Supabase Table Editor meanwhile)
Admin screens for students, activities, judges, event settings, announcements, winners and prize assignment, CSV score upload with preview, CSV/print reports, audit-log viewer.
Winners: add rows to `winners` (category, student_id, prize) and set `published` to true when approved. Edit venue and age in `settings` once confirmed.
