/**
 * Converts a datetime-local input value (which represents local time)
 * to an ISO string (which is UTC).
 *
 * @param datetimeLocalValue - The value from a datetime-local input (format: "YYYY-MM-DDTHH:mm")
 * @returns ISO string in UTC timezone
 */
export function datetimeLocalToISO(datetimeLocalValue: string): string {
  const [datePart, timePart] = datetimeLocalValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];

  // Create date in local timezone and convert to ISO (UTC)
  const localDate = new Date(year, month - 1, day, hour, minute);
  return localDate.toISOString();
}

/**
 * Checks if an event date has passed (is in the past).
 *
 * @param dateString - ISO string from database
 * @returns true if the event date has passed
 */
export function isEventExpired(dateString: string): boolean {
  const eventDate = new Date(dateString);
  const now = new Date();
  return eventDate.getTime() < now.getTime();
}

/**
 * Checks if an event is upcoming (in the future).
 *
 * @param dateString - ISO string from database
 * @returns true if the event is in the future
 */
export function isEventUpcoming(dateString: string): boolean {
  return !isEventExpired(dateString);
}
