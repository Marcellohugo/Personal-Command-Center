"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date";
import { expenseSchema } from "@/lib/validations/expense";

export async function createExpense(formData: FormData) {
  const user = await requireCurrentUser();
  const input = expenseSchema.parse(Object.fromEntries(formData));

  await prisma.expense.create({
    data: {
      userId: user.id,
      amount: input.amount,
      category: input.category,
      note: input.note || null,
      date: parseDateInput(input.date),
      source: input.source
    }
  });

  revalidatePath("/");
  revalidatePath("/expenses");
}

export async function updateExpense(formData: FormData) {
  const user = await requireCurrentUser();
  const id = String(formData.get("id") ?? "");
  const input = expenseSchema.parse(Object.fromEntries(formData));

  await prisma.expense.updateMany({
    where: {
      id,
      userId: user.id
    },
    data: {
      amount: input.amount,
      category: input.category,
      note: input.note || null,
      date: parseDateInput(input.date),
      source: input.source
    }
  });

  revalidatePath("/");
  revalidatePath("/expenses");
}

export async function deleteExpense(formData: FormData) {
  const user = await requireCurrentUser();
  const id = String(formData.get("id") ?? "");

  await prisma.expense.deleteMany({
    where: {
      id,
      userId: user.id
    }
  });

  revalidatePath("/");
  revalidatePath("/expenses");
}
