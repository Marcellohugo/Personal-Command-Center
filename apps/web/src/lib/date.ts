import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";

export function toDateOnlyString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function dayRange(date = new Date()) {
  return {
    gte: startOfDay(date),
    lte: endOfDay(date)
  };
}

export function weekRange(date = new Date()) {
  return {
    gte: startOfWeek(date, { weekStartsOn: 1 }),
    lte: endOfWeek(date, { weekStartsOn: 1 })
  };
}

export function monthRange(date = new Date()) {
  return {
    gte: startOfMonth(date),
    lte: endOfMonth(date)
  };
}

export type CalendarPeriod = "day" | "week" | "month";

export function calendarRange(period: CalendarPeriod, date = new Date()) {
  return period === "week" ? weekRange(date) : period === "month" ? monthRange(date) : dayRange(date);
}

export function isDateInDay(date: Date, target = new Date()) {
  return isWithinInterval(date, {
    start: startOfDay(target),
    end: endOfDay(target)
  });
}

export function isDateInWeek(date: Date, target = new Date()) {
  return isWithinInterval(date, {
    start: startOfWeek(target, { weekStartsOn: 1 }),
    end: endOfWeek(target, { weekStartsOn: 1 })
  });
}

export function isDateInMonth(date: Date, target = new Date()) {
  return isWithinInterval(date, {
    start: startOfMonth(target),
    end: endOfMonth(target)
  });
}
