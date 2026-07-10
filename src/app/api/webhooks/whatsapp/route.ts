import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateInput, dayRange, weekRange, monthRange } from "@/lib/date";
import { parseWhatsAppCommand } from "@/lib/whatsapp/parser";
import { sendWhatsAppText } from "@/lib/whatsapp/service";
import { buildDailySummary } from "@/lib/summary";
import { formatCurrency } from "@/lib/utils";

type WhatsAppTextMessage = {
  from: string;
  id?: string;
  text?: {
    body?: string;
  };
};

type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppTextMessage[];
      };
    }>;
  }>;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as WhatsAppPayload;
  const messages = extractTextMessages(payload);

  for (const message of messages) {
    const body = message.text?.body?.trim();

    if (!body) {
      continue;
    }

    const responseText = await handleTextCommand({
      body,
      from: message.from,
      messageId: message.id,
      payload
    });

    if (message.from) {
      await sendWhatsAppText(message.from, responseText);
    }
  }

  return NextResponse.json({ received: true, processed: messages.length });
}

function extractTextMessages(payload: WhatsAppPayload) {
  return (
    payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []
    ) ?? []
  ).filter((message) => Boolean(message.text?.body));
}

async function handleTextCommand(input: {
  body: string;
  from: string;
  messageId?: string;
  payload: WhatsAppPayload;
}) {
  const user = await findUserForWhatsApp(input.from);
  const command = parseWhatsAppCommand(input.body);

  if (!user) {
    const response = "User WhatsApp belum terhubung ke akun Personal Command Center.";
    await logWhatsAppMessage(input, null, response, "unmatched_user");
    return response;
  }

  let response = "";
  let status = "processed";

  if (command.type === "expense") {
    await prisma.expense.create({
      data: {
        userId: user.id,
        amount: command.amount,
        category: command.category,
        note: command.note,
        date: new Date(),
        source: command.source
      }
    });

    response = `Pengeluaran ${formatCurrency(command.amount)} untuk ${command.note} sudah dicatat.`;
  } else if (command.type === "schedule") {
    await prisma.schedule.create({
      data: {
        userId: user.id,
        title: command.title,
        date: parseDateInput(command.date),
        startTime: command.startTime,
        source: command.source
      }
    });

    response = `Jadwal ${command.title} pada ${command.date} ${command.startTime} sudah dicatat.`;
  } else if (command.type === "summary") {
    response = await buildTodaySummaryResponse(user.id);
  } else if (command.type === "total") {
    response = await buildTotalResponse(user.id, command.period);
  } else {
    status = "unknown_command";
    response = command.reason;
  }

  await logWhatsAppMessage(input, user.id, response, status);
  return response;
}

async function findUserForWhatsApp(from: string) {
  const directUser = await prisma.user.findFirst({
    where: {
      phoneNumber: {
        in: [from, from.replace(/^\+/, "")]
      }
    }
  });

  if (directUser) {
    return directUser;
  }

  return prisma.user.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });
}

async function buildTodaySummaryResponse(userId: string) {
  const range = dayRange();
  const [schedules, expenses, incompleteHabits] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        userId,
        date: range
      },
      orderBy: [{ startTime: "asc" }]
    }),
    prisma.expense.findMany({
      where: {
        userId,
        date: range
      }
    }),
    prisma.habit.findMany({
      where: {
        userId,
        logs: {
          none: {
            completedAt: range
          }
        }
      }
    })
  ]);

  return buildDailySummary({ schedules, expenses, incompleteHabits });
}

async function buildTotalResponse(userId: string, period: "week" | "month") {
  const range = period === "week" ? weekRange() : monthRange();
  const result = await prisma.expense.aggregate({
    where: {
      userId,
      date: range
    },
    _sum: {
      amount: true
    }
  });

  const label = period === "week" ? "minggu ini" : "bulan ini";
  return `Total pengeluaran ${label}: ${formatCurrency(result._sum.amount ?? 0)}.`;
}

async function logWhatsAppMessage(
  input: {
    body: string;
    from: string;
    messageId?: string;
    payload: WhatsAppPayload;
  },
  userId: string | null,
  response: string,
  status: string
) {
  await prisma.whatsAppMessageLog.create({
    data: {
      userId,
      from: input.from,
      messageId: input.messageId,
      command: input.body,
      rawPayload: input.payload,
      response,
      status
    }
  });
}
