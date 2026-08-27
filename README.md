# Marco Life OS

Marco Life OS adalah workspace pribadi local-first untuk mengelola lima area hidup: karier, belajar, kesehatan, keuangan, dan personal. Web/PWA di Vercel dan Windows memakai PostgreSQL pusat di Supabase, tetapi tetap dapat mencatat saat offline.

## Fitur utama

- Dashboard terpandu dengan ritual pagi dan malam yang dapat dilewati.
- Maksimal tiga prioritas harian, agenda, notes, transaksi, habit, focus session, dan ticket Kanban bergaya GitHub.
- Siklus 12 minggu, goal tanpa batas per area, weekly review lima menit, dan maksimal tiga quest manual.
- Progres goal manual 0–100% serta evidence aktivitas yang ditampilkan terpisah.
- Gamifikasi konsistensi: XP, level lifetime, streak, Perfect Day, dan achievement.
- Login password-only dengan akun tetap `marco.marcello15@gmail.com`, password awal `123456`, dan perubahan password dari Settings.
- Sinkronisasi per-record dengan penggabungan otomatis untuk record berbeda dan konflik terarah untuk record yang sama.
- Google Calendar opsional: agenda aplikasi dikirim ke Google; import Google hanya saat diminta.
- Pusat Keuangan: laporan per periode, planned-vs-actual budget, rollover/amplop/zero-based, proyeksi arus kas 30/60/90 hari, strategi utang snowball/avalanche, investasi dan kekayaan bersih.
- Pencatatan keuangan lanjutan: CSV import/export dengan deteksi duplikat, status pending/cleared/reconciled, split kategori, struk + OCR browser, rekonsiliasi, kunci periode, dan audit trail.
- Workspace Catatan: jurnal dan template, Markdown, lampiran + OCR, pencarian tersimpan, arsip/sampah, riwayat versi, backlink, relasi lintas modul, pengingat, serta konversi checklist menjadi ticket atau agenda.
- Tampilan biru energik, dark mode, keyboard focus, dan reduced motion.

WhatsApp/WAHA sengaja tidak termasuk dalam runtime maupun `docker compose`.

## Struktur

- `apps/web` — Next.js/PWA, dashboard, API, dan cache offline browser.
- `apps/desktop` — Windows WPF, cache lokal terenkripsi DPAPI, dan notifikasi lokal.
- `apps/ios` — source Flutter lama yang dinonaktifkan dan tidak ikut CI/deployment.
- `packages/database` — Prisma schema dan migration PostgreSQL.

## Menjalankan lokal

Persyaratan: Node.js, Docker Desktop, dan .NET 10 SDK untuk Windows.

```powershell
npm install
Copy-Item .env.example .env
npm run db:generate
docker compose up --build -d
```

Dashboard tersedia di [http://localhost:3001/dashboard](http://localhost:3001/dashboard). Password awal pada `.env.example` adalah contoh; deployment pribadi sebaiknya menggantinya dengan password kuat.

Database lokal disimpan pada volume Docker `personal-command-center_postgres_data`. Deployment utama memakai Supabase sebagai PostgreSQL pusat dan Vercel untuk Next.js/PWA. RLS aktif dan Data API tidak mengekspos tabel aplikasi kepada klien anonim.

Seluruh fitur modern—termasuk catatan, keuangan, Kanban, agenda, dan pengaturan—disimpan sebagai satu snapshot workspace pada record Supabase yang sama dan dilindungi login server serta RLS. Lampiran kecil ikut di snapshot; file besar sebaiknya memakai tautan eksternal agar sinkronisasi tetap ringan. Cache browser dan cache Windows hanya salinan offline, bukan database terpisah.

## Google Calendar

1. Aktifkan Google Calendar API dan buat OAuth Web Client.
2. Tambahkan redirect URI `http://localhost:3001/api/auth/google/callback`.
3. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_CALENDAR_ENABLED="true"`.
4. Buka **Pengaturan → Integrasi → Hubungkan Google**.

Token disimpan terenkripsi menggunakan `APP_SESSION_SECRET`. Jangan meng-commit `.env` atau secret Google.

## Pengingat push

Docker menjalankan scheduler ringan setiap menit untuk ritual pagi, ritual malam, dan review mingguan. Kunci VAPID lokal disimpan di `.env`; aktifkan dari **Pengaturan → Aktifkan pengingat** pada setiap browser/perangkat. Untuk deployment non-Docker, panggil `POST /api/notifications/run` setiap menit dengan header `Authorization: Bearer <CRON_SECRET>`.

## Windows

```powershell
npm run desktop:test
npm run desktop:run
npm run desktop:publish
```

Installer pribadi tidak ditandatangani secara berbayar sehingga Windows SmartScreen dapat menampilkan peringatan. Cache lokal berada di `%LOCALAPPDATA%\PersonalCommandCenter\workspace.json`.

## iPhone

Build Flutter native dinonaktifkan. Gunakan PWA melalui Safari → **Add to Home Screen**; source lama tetap di `apps/ios` hanya sebagai arsip yang dapat dipulihkan.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run desktop:build
npm run desktop:test
```
