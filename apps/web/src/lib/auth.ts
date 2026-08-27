import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";

const LOCAL_USER = {
  email: process.env.APP_USER_EMAIL || "demo@example.com",
  name: process.env.APP_USER_NAME || "Pengguna Utama"
};

export async function getCurrentUser() {
  noStore();
  // ponytail: one local user keeps the app login-free; add account selection only for multi-user deployments.
  return prisma.user.upsert({
    where: { email: LOCAL_USER.email },
    update: {},
    create: LOCAL_USER,
    select: { id: true, email: true, name: true }
  });
}

export async function requireCurrentUser() {
  return getCurrentUser();
}
