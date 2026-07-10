import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      name: "Demo User",
      passwordHash
    },
    create: {
      name: "Demo User",
      email: "demo@example.com",
      passwordHash,
      phoneNumber: "6281234567890"
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
