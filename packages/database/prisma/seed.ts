import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      name: "Demo User",
      monthlyBudget: 3000000
    },
    create: {
      name: "Demo User",
      email: "demo@example.com",
      monthlyBudget: 3000000
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.schedule.createMany({
    data: [
      {
        userId: user.id,
        title: "Rapat bimbingan",
        description: "Diskusi progres mingguan",
        date: today,
        startTime: "10:00",
        endTime: "11:00",
        location: "Kampus",
        source: "manual"
      },
      {
        userId: user.id,
        title: "Review rencana belajar",
        date: today,
        startTime: "19:30",
        source: "manual"
      }
    ],
    skipDuplicates: true
  });

  await prisma.expense.createMany({
    data: [
      {
        userId: user.id,
        amount: 25000,
        category: "Makanan & Minuman",
        note: "Kopi",
        date: today,
        source: "manual"
      },
      {
        userId: user.id,
        amount: 15000,
        category: "Transportasi",
        note: "Ojek",
        date: today,
        source: "manual"
      }
    ],
    skipDuplicates: true
  });

  const habit = await prisma.habit.upsert({
    where: { id: "seed-habit-minum-air" },
    update: {},
    create: {
      id: "seed-habit-minum-air",
      userId: user.id,
      name: "Minum air putih",
      frequency: "daily"
    }
  });

  await prisma.habitLog.create({
    data: {
      habitId: habit.id,
      completedAt: today
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
