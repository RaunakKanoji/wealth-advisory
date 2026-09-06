const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMaturityDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthName = MONTHS[month - 1];

  if (!year || !monthName || !day) {
    return "Maturity date unavailable";
  }

  return `Matures on ${day} ${monthName} ${year}`;
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) {
    return "Date unavailable";
  }

  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const monthName = MONTHS[month - 1];

  if (!year || !monthName || !day) {
    return "Date unavailable";
  }

  return `${day} ${monthName} ${year}`;
}

export function formatFreshness(isoDate?: string): string {
  return isoDate ? `Updated ${formatDate(isoDate)}` : "Update time unavailable";
}
