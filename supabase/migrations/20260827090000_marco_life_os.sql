-- Complete production schema for Marco Life OS.
-- The web app connects through Prisma; public Data API roles get no table access.

create type public."ScheduleSource" as enum ('manual', 'whatsapp', 'google_calendar');
create type public."ExpenseSource" as enum ('manual', 'whatsapp');
create type public."HabitFrequency" as enum ('daily', 'weekly');

create table public."User" (
  "id" text primary key,
  "name" text,
  "email" text not null unique,
  "passwordHash" text,
  "phoneNumber" text unique,
  "monthlyBudget" integer,
  "googleAccessToken" text,
  "googleRefreshToken" text,
  "googleTokenExpiry" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."Schedule" (
  "id" text primary key,
  "title" text not null,
  "description" text,
  "date" timestamp(3) not null,
  "startTime" text not null,
  "endTime" text,
  "location" text,
  "source" public."ScheduleSource" not null default 'manual',
  "googleEventId" text,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."Expense" (
  "id" text primary key,
  "amount" integer not null,
  "category" text not null,
  "note" text,
  "date" timestamp(3) not null,
  "source" public."ExpenseSource" not null default 'manual',
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."Habit" (
  "id" text primary key,
  "name" text not null,
  "frequency" public."HabitFrequency" not null default 'daily',
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."HabitLog" (
  "id" text primary key,
  "habitId" text not null references public."Habit"("id") on delete cascade on update cascade,
  "completedAt" timestamp(3) not null default current_timestamp,
  "createdAt" timestamp(3) not null default current_timestamp
);

create table public."Note" (
  "id" text primary key,
  "title" text not null,
  "content" text not null,
  "pinned" boolean not null default false,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."WorkspaceSnapshot" (
  "id" text primary key,
  "userId" text not null unique references public."User"("id") on delete cascade on update cascade,
  "data" jsonb not null,
  "revision" integer not null default 0,
  "generation" integer not null default 1,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."WorkspaceItem" (
  "id" text primary key,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "entityType" text not null,
  "entityId" text not null,
  "generation" integer not null default 1,
  "version" integer not null default 1,
  "payload" jsonb,
  "deletedAt" timestamp(3),
  "deviceId" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  unique ("userId", "generation", "entityType", "entityId")
);

create table public."WorkspaceChange" (
  "id" text primary key,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "generation" integer not null default 1,
  "entityType" text not null,
  "entityId" text not null,
  "version" integer not null,
  "payload" jsonb,
  "deleted" boolean not null default false,
  "deviceId" text,
  "createdAt" timestamp(3) not null default current_timestamp
);

create table public."WorkspaceConflict" (
  "id" text primary key,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "generation" integer not null default 1,
  "entityType" text not null,
  "entityId" text not null,
  "serverVersion" integer not null,
  "serverPayload" jsonb,
  "localPayload" jsonb,
  "localDeviceId" text,
  "resolvedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp
);

create table public."PushSubscription" (
  "id" text primary key,
  "userId" text not null references public."User"("id") on delete cascade on update cascade,
  "endpoint" text not null unique,
  "p256dh" text not null,
  "auth" text not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table public."WhatsAppMessageLog" (
  "id" text primary key,
  "userId" text references public."User"("id") on delete set null on update cascade,
  "from" text,
  "messageId" text unique,
  "command" text,
  "rawPayload" jsonb not null,
  "response" text,
  "status" text not null default 'received',
  "createdAt" timestamp(3) not null default current_timestamp
);

create index "Schedule_userId_date_idx" on public."Schedule"("userId", "date");
create index "Expense_userId_date_idx" on public."Expense"("userId", "date");
create index "Expense_userId_category_idx" on public."Expense"("userId", "category");
create index "Habit_userId_idx" on public."Habit"("userId");
create index "HabitLog_habitId_completedAt_idx" on public."HabitLog"("habitId", "completedAt");
create index "Note_userId_pinned_updatedAt_idx" on public."Note"("userId", "pinned", "updatedAt");
create index "WorkspaceItem_userId_generation_updatedAt_idx" on public."WorkspaceItem"("userId", "generation", "updatedAt");
create index "WorkspaceChange_userId_generation_id_idx" on public."WorkspaceChange"("userId", "generation", "id");
create index "WorkspaceConflict_userId_generation_resolvedAt_idx" on public."WorkspaceConflict"("userId", "generation", "resolvedAt");
create index "PushSubscription_userId_idx" on public."PushSubscription"("userId");
create index "WhatsAppMessageLog_userId_createdAt_idx" on public."WhatsAppMessageLog"("userId", "createdAt");

-- The browser never queries Supabase directly. RLS plus revoked grants makes the
-- Data API fail closed; Prisma's database owner connection remains functional.
alter table public."User" enable row level security;
alter table public."Schedule" enable row level security;
alter table public."Expense" enable row level security;
alter table public."Habit" enable row level security;
alter table public."HabitLog" enable row level security;
alter table public."Note" enable row level security;
alter table public."WorkspaceSnapshot" enable row level security;
alter table public."WorkspaceItem" enable row level security;
alter table public."WorkspaceChange" enable row level security;
alter table public."WorkspaceConflict" enable row level security;
alter table public."PushSubscription" enable row level security;
alter table public."WhatsAppMessageLog" enable row level security;

-- Supabase provides these Data API roles. Guard them so the same migration can
-- also be verified against a plain PostgreSQL instance during CI/local testing.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end
$$;
