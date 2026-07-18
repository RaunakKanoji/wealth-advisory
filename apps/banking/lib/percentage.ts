export function clampPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}
