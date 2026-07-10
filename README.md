# Personal Command Center

MVP web app untuk mencatat jadwal, pengeluaran, habit harian, ringkasan aktivitas, serta fondasi integrasi WhatsApp Business Cloud API dan Google Calendar.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth credentials login
- Zod
- Recharts

## Struktur Folder

- `src/app` - App Router pages, API routes, auth route, webhook WhatsApp.
- `src/components` - Layout, form, chart, dan dashboard UI.
- `src/lib` - Prisma client, auth config, validasi Zod, helper dashboard, parser WhatsApp, services integrasi.
- `prisma/schema.prisma` - Model `User`, `Schedule`, `Expense`, `Habit`, `HabitLog`, `WhatsAppMessageLog`.
- `prisma/seed.ts` - Seed user demo, jadwal, pengeluaran, dan habit.
- `tests` - Unit test untuk parser WhatsApp dan helper dashboard.

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat file `.env` dari `.env.example`, lalu isi `DATABASE_URL` PostgreSQL dan `AUTH_SECRET`.

3. Jalankan migration dan seed:

```bash
npm run prisma:migrate
npm run seed
```

4. Jalankan development server:

```bash
npm run dev
```

5. Buka `http://localhost:3000`.

User demo dari seed:

- Email: `demo@example.com`
- Password: `password123`

## Script

- `npm run dev` - menjalankan Next.js dev server.
- `npm run build` - generate Prisma Client dan build Next.js.
- `npm run typecheck` - cek TypeScript.
- `npm test` - jalankan Vitest.
- `npm run prisma:migrate` - menjalankan Prisma migration dev.
- `npm run prisma:studio` - membuka Prisma Studio.
- `npm run seed` - isi data demo.

## WhatsApp Business Cloud API

Environment variable yang disiapkan:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`

Endpoint:

- `POST /api/webhooks/whatsapp`
- `GET /api/webhooks/whatsapp` untuk verifikasi webhook token.

Command MVP:

- `/jadwal Besok 10:00 Rapat bimbingan`
- `/uang 25000 kopi`
- `/ringkasan hari ini`
- `/total minggu ini`
- `/total bulan ini`

Untuk MVP single-user, webhook akan mencocokkan nomor WhatsApp ke `User.phoneNumber`. Jika tidak ditemukan, app memakai user pertama sebagai fallback agar integrasi awal tetap bisa diuji lokal.

## Google Calendar

File placeholder ada di `src/lib/google-calendar.ts`:

- `createCalendarEvent()`
- `updateCalendarEvent()`
- `deleteCalendarEvent()`

OAuth penuh belum diimplementasikan sesuai scope MVP.
