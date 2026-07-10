export type CalendarEventInput = {
  id?: string;
  title: string;
  description?: string | null;
  date: Date;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
};

export async function createCalendarEvent(_event: CalendarEventInput) {
  // TODO: Implement Google Calendar OAuth and event creation after MVP auth scope is decided.
  return null;
}

export async function updateCalendarEvent(_event: CalendarEventInput) {
  // TODO: Implement Google Calendar OAuth and event update after calendar account linking exists.
  return null;
}

export async function deleteCalendarEvent(_eventId: string) {
  // TODO: Implement Google Calendar OAuth and event deletion after external IDs are stored.
  return null;
}
