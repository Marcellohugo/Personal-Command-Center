import { addDays } from "date-fns";
import { DEFAULT_EXPENSE_CATEGORY } from "@/lib/constants";
import { toDateOnlyString } from "@/lib/date";

type ParserOptions = {
  now?: Date;
};

export type WhatsAppCommand =
  | {
      type: "expense";
      amount: number;
      note: string;
      category: string;
      source: "whatsapp";
    }
  | {
      type: "schedule";
      date: string;
      startTime: string;
      title: string;
      source: "whatsapp";
    }
  | {
      type: "summary";
      period: "today";
    }
  | {
      type: "total";
      period: "week" | "month";
    }
  | {
      type: "unknown";
      reason: string;
    };

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseWhatsAppCommand(text: string, options: ParserOptions = {}): WhatsAppCommand {
  const normalized = text.trim().replace(/\s+/g, " ");
  const lowered = normalized.toLowerCase();

  if (lowered.startsWith("/uang ")) {
    return parseExpenseCommand(normalized);
  }

  if (lowered.startsWith("/jadwal ")) {
    return parseScheduleCommand(normalized, options.now ?? new Date());
  }

  if (lowered === "/ringkasan hari ini") {
    return {
      type: "summary",
      period: "today"
    };
  }

  if (lowered === "/total minggu ini") {
    return {
      type: "total",
      period: "week"
    };
  }

  if (lowered === "/total bulan ini") {
    return {
      type: "total",
      period: "month"
    };
  }

  return {
    type: "unknown",
    reason: "Command tidak dikenali."
  };
}

function parseExpenseCommand(text: string): WhatsAppCommand {
  const [, amountText, ...noteParts] = text.split(" ");
  const amount = Number(amountText);
  const note = noteParts.join(" ").trim();

  if (!Number.isInteger(amount) || amount <= 0 || !note) {
    return {
      type: "unknown",
      reason: "Format pengeluaran harus seperti /uang 25000 kopi."
    };
  }

  return {
    type: "expense",
    amount,
    note,
    category: DEFAULT_EXPENSE_CATEGORY,
    source: "whatsapp"
  };
}

function parseScheduleCommand(text: string, now: Date): WhatsAppCommand {
  const [, dayToken, timeToken, ...titleParts] = text.split(" ");
  const title = titleParts.join(" ").trim();

  if (!dayToken || !timeToken || !timePattern.test(timeToken) || !title) {
    return {
      type: "unknown",
      reason: "Format jadwal harus seperti /jadwal Besok 10:00 Rapat bimbingan."
    };
  }

  const date = resolveRelativeDate(dayToken, now);

  if (!date) {
    return {
      type: "unknown",
      reason: "Tanggal hanya mendukung Hari ini atau Besok untuk MVP."
    };
  }

  return {
    type: "schedule",
    date: toDateOnlyString(date),
    startTime: timeToken,
    title,
    source: "whatsapp"
  };
}

function resolveRelativeDate(dayToken: string, now: Date) {
  const lowered = dayToken.toLowerCase();

  if (lowered === "besok") {
    return addDays(now, 1);
  }

  if (lowered === "hari" || lowered === "today") {
    return now;
  }

  return null;
}
