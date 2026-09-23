export const queryKeys = {
  accounts: {
    all: ["accounts"] as const,
    detail: (id: string) => ["accounts", id] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (filters: Record<string, unknown> = {}) => ["transactions", "list", stableFilterKey(filters)] as const,
  },
  beneficiaries: { all: ["beneficiaries"] as const },
  transfers: { all: ["transfers"] as const, detail: (id: string) => ["transfers", id] as const },
  cards: { all: ["cards"] as const, list: (accountId?: string) => ["cards", "list", accountId ?? "all"] as const, detail: (id: string) => ["cards", id] as const },
  notifications: { all: ["notifications"] as const, list: (type = "all") => ["notifications", type] as const, preferences: ["notifications", "preferences"] as const },
  wealth: { summary: ["wealth", "summary"] as const, insights: ["wealth", "insights"] as const, goals: ["wealth", "goals"] as const },
  coach: { conversations: ["coach", "conversations"] as const, messages: (id: string) => ["coach", "messages", id] as const },
  services: { catalog: ["services", "catalog"] as const, favorites: ["services", "favorites"] as const },
} as const;

function stableFilterKey(filters: Record<string, unknown>): string {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}
