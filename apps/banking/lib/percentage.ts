export function clampPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}
