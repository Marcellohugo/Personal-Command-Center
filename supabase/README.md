# Supabase deployment

Supabase adalah PostgreSQL pusat untuk deployment produksi. Hubungkan repository GitHub dengan working directory `.` agar migration di folder ini diterapkan dari branch `main`. Tabel aplikasi memakai nama Prisma yang sama dan RLS tanpa policy anonim. Keep `APP_SESSION_SECRET` unchanged when migrating encrypted Google tokens.

Required production settings:

- `DATABASE_URL` — Supabase pooled connection string.
- `APP_URL` — Vercel URL or custom domain.
- `APP_USER_EMAIL=marco.marcello15@gmail.com`.
- `APP_PASSWORD` and `APP_SESSION_SECRET` as secrets.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ENABLED=true`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `CRON_SECRET` untuk pengingat push.

Gunakan Supabase Cron untuk memanggil `POST /api/notifications/run` setiap menit dengan header bearer `CRON_SECRET`. Web/PWA dan Windows membaca PostgreSQL pusat yang sama melalui API Next.js.

The service role key, if used by an Edge Function, must never be exposed to the browser or committed to the repository.
