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
