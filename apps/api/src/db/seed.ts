import { db, closeDatabase } from "./client.js";
import { inArray } from "drizzle-orm";
import {
  accountBalances,
  accounts,
  auditEvents,
  beneficiaries,
  cardControls,
  cardTransactions,
  cards,
  coachConversations,
  coachMessages,
  financialInsights,
  monthlyFinancialSnapshots,
  notificationPreferences,
  notifications,
  profiles,
  serviceCatalog,
  serviceFavorites,
  transactionCategories,
  transactions,
  transferEvents,
  transfers,
  users,
  wealthGoals,
} from "./schema/index.js";

const userA = "usr_demo_a";
const userB = "usr_demo_b";
const accountSavings = "acc_demo_savings";
const accountCurrent = "acc_demo_current";
const accountFd = "acc_demo_fd";
const accountRd = "acc_demo_rd";
const now = new Date("2026-09-11T10:00:00.000Z");

const money = (rupees: number) => `${rupees}.00`;
const at = (isoDate: string) => new Date(`${isoDate}T10:00:00.000Z`);

const categories = [
  ["category_salary", "salary", "Salary", "income", "cash-outline"],
  ["category_food", "food_dining", "Food & Dining", "expense", "restaurant-outline"],
  ["category_shopping", "shopping", "Shopping", "expense", "bag-handle-outline"],
  ["category_transport", "transport", "Transport", "expense", "car-outline"],
  ["category_utilities", "utilities", "Utilities", "expense", "flash-outline"],
  ["category_transfer", "transfer", "Transfer", "transfer", "swap-horizontal-outline"],
  ["category_investment", "investment", "Investment", "expense", "trending-up-outline"],
  ["category_cash", "cash", "Cash", "expense", "cash-outline"],
  ["category_refund", "refund", "Refund", "income", "return-up-back-outline"],
  ["category_other", "other", "Other", "expense", "ellipsis-horizontal-circle-outline"],
] as const;

const services = [
  ["svc_my_accounts", "my-accounts", "My accounts", "View balances and linked accounts.", "accounts", "wallet-outline", "green", "/(app)/(tabs)/accounts", ["accounts", "balance"]],
  ["svc_account_details", "account-details", "Account details", "View account information and settings.", "accounts", "card-outline", "green", "/(app)/accounts/details", ["account profile"]],
  ["svc_transaction_history", "transaction-history", "Transaction history", "Search and filter account activity.", "accounts", "list-outline", "green", "/(app)/activity", ["transactions", "activity"]],
  ["svc_statements", "statements", "Statements", "View or export a statement for an account.", "accounts", "document-text-outline", "green", "/(app)/accounts/statements", ["statement", "documents"]],
  ["svc_fixed_deposits", "fixed-deposits", "Fixed deposits", "Review fixed-deposit information.", "accounts", "lock-closed-outline", "orange", "/(app)/services/info/svc_fixed_deposits", ["fd", "deposit"]],
  ["svc_recurring_deposits", "recurring-deposits", "Recurring deposits", "Review recurring-deposit information.", "accounts", "calendar-outline", "orange", "/(app)/services/info/svc_recurring_deposits", ["rd"]],
  ["svc_transfer_money", "transfer-money", "Transfer money", "Send money to accounts or UPI IDs.", "payments", "swap-horizontal-outline", "green", "/(app)/transfers/new", ["send", "payment"]],
  ["svc_scan_qr", "scan-qr", "Scan QR", "Pay securely using a QR code.", "payments", "qr-code-outline", "orange", "/(app)/scan-qr", ["upi", "qr"]],
  ["svc_beneficiaries", "beneficiaries", "Beneficiaries", "Manage saved recipients.", "payments", "people-outline", "green", "/(app)/beneficiaries", ["recipients"]],
  ["svc_transfer_history", "transfer-history", "Transfer history", "Review transfer attempts and statuses.", "payments", "time-outline", "green", "/(app)/transfers/history", ["transfers"]],
  ["svc_my_cards", "my-cards", "My cards", "View and manage your cards.", "cards", "card-outline", "green", "/(app)/cards", ["debit", "credit"]],
  ["svc_card_controls", "card-controls", "Card controls", "Manage card usage controls.", "cards", "options-outline", "green", "/(app)/cards", ["freeze", "controls"]],
  ["svc_card_limits", "card-limits", "Card limits", "Review and edit card limits.", "cards", "speedometer-outline", "green", "/(app)/cards", ["limits"]],
  ["svc_lost_card", "lost-card", "Lost or stolen card", "Review lost-card assistance options.", "cards", "alert-circle-outline", "orange", "/(app)/cards", ["block"]],
  ["svc_card_statements", "card-statements", "Card statements", "Review supported credit-card billing.", "cards", "receipt-outline", "green", "/(app)/services/info/svc_card_statements", ["billing"]],
  ["svc_wealth_coach", "wealth-coach", "Wealth Coach", "Ask the Wealth Coach for guidance.", "wealth", "sparkles-outline", "green", "/(app)/(tabs)/coach", ["coach", "advice"]],
  ["svc_financial_goals", "financial-goals", "Financial goals", "Track progress toward your financial goals.", "wealth", "flag-outline", "green", "/(app)/coach/recommendations", ["goals"]],
  ["svc_spending_insights", "spending-insights", "Spending insights", "Review available spending observations.", "wealth", "analytics-outline", "green", "/(app)/(tabs)/coach", ["insights"]],
  ["svc_investments", "investments", "Investments", "Learn about investment information in the app.", "wealth", "trending-up-outline", "orange", "/(app)/services/info/svc_investments", ["invest"]],
  ["svc_financial_reports", "financial-reports", "Financial reports", "Review available financial reports.", "wealth", "bar-chart-outline", "orange", "/(app)/services/info/svc_financial_reports", ["reports"]],
  ["svc_offers", "offers", "Offers", "Review current offers information.", "wealth", "pricetag-outline", "orange", "/(app)/offers", ["deals"]],
  ["svc_loans", "loans", "Loans", "Learn about available loan information.", "loans", "cash-outline", "orange", "/(app)/services/info/svc_loans", ["borrow"]],
  ["svc_insurance", "insurance", "Insurance", "Learn about available insurance information.", "loans", "shield-checkmark-outline", "orange", "/(app)/services/info/svc_insurance", ["cover"]],
  ["svc_tax_documents", "tax-documents", "Tax & documents", "Find account documents and statements.", "documents", "document-text-outline", "green", "/(app)/documents", ["tax"]],
  ["svc_service_requests", "service-requests", "Service requests", "Review service-request information.", "documents", "chatbox-ellipses-outline", "green", "/(app)/service-requests", ["requests"]],
  ["svc_profile", "profile", "Profile", "Manage your personal information.", "security", "person-outline", "green", "/(app)/profile", ["personal"]],
  ["svc_security_settings", "security-settings", "Security settings", "Review available security settings.", "security", "shield-outline", "green", "/(app)/security", ["security"]],
  ["svc_privacy", "privacy", "Privacy & consent", "Review privacy and consent handling.", "security", "lock-closed-outline", "green", "/(app)/services/info/svc_privacy", ["privacy"]],
  ["svc_notification_preferences", "notification-preferences", "Notifications", "Review notification settings.", "security", "notifications-outline", "green", "/(app)/notifications", ["alerts"]],
  ["svc_help_center", "help-center", "Help center", "Find available support options.", "support", "help-circle-outline", "green", "/(app)/support", ["help"]],
  ["svc_contact_support", "contact-support", "Contact support", "Review contact-support options.", "support", "call-outline", "green", "/(app)/support/contact", ["contact"]],
  ["svc_branch_atm", "branch-atm", "Branch & ATM locator", "Review branch and ATM locator information.", "support", "location-outline", "orange", "/(app)/locations", ["branch", "atm"]],
] as const;

function transactionRows() {
  const rows: Array<typeof transactions.$inferInsert> = [];

  // August & September 2026 featured transactions
  const featuredTransactions: Array<typeof transactions.$inferInsert> = [
    {
      id: "tx_2026_09_acme_salary",
      accountId: accountCurrent,
      type: "salary",
      direction: "credit",
      amount: money(85000),
      currency: "INR",
      description: "Salary credit",
      merchantName: "Acme Technologies",
      categoryId: "category_salary",
      reference: "NEFT-ACME-85000",
      transactionAt: at("2026-09-01"),
      status: "completed",
      metadataJson: { seeded: true, channel: "NEFT" },
    },
    {
      id: "tx_2026_09_green_fork",
      accountId: accountSavings,
      type: "purchase",
      direction: "debit",
      amount: money(4500),
      currency: "INR",
      description: "Dining at The Green Fork",
      merchantName: "The Green Fork",
      categoryId: "category_food",
      reference: "CARD-TGF-4500",
      transactionAt: at("2026-09-03"),
      status: "completed",
      metadataJson: { seeded: true, channel: "Card" },
    },
    {
      id: "tx_2026_09_quickbite",
      accountId: accountSavings,
      type: "purchase",
      direction: "debit",
      amount: money(4500),
      currency: "INR",
      description: "QuickBite order",
      merchantName: "QuickBite",
      categoryId: "category_food",
      reference: "UPI-QB-4500",
      transactionAt: at("2026-09-05"),
      status: "completed",
      metadataJson: { seeded: true, channel: "UPI" },
    },
    {
      id: "tx_2026_09_cedar_table",
      accountId: accountSavings,
      type: "purchase",
      direction: "debit",
      amount: money(6000),
      currency: "INR",
      description: "Dinner at Cedar Table",
      merchantName: "Cedar Table",
      categoryId: "category_food",
      reference: "UPI-CT-6000",
      transactionAt: at("2026-09-07"),
      status: "completed",
      metadataJson: { seeded: true, channel: "UPI" },
    },
    {
      id: "tx_2026_09_rohan_shah",
      accountId: accountSavings,
      type: "transfer",
      direction: "debit",
      amount: money(28000),
      currency: "INR",
      description: "Transfer to Rohan Shah",
      merchantName: "Rohan Shah",
      categoryId: "category_transfer",
      reference: "NEFT-RS-28000",
      transactionAt: at("2026-09-08"),
      status: "completed",
      metadataJson: { seeded: true, channel: "NEFT" },
    },
    {
      id: "tx_2026_09_fresh_basket",
      accountId: accountSavings,
      type: "purchase",
      direction: "debit",
      amount: money(2350),
      currency: "INR",
      description: "Groceries at Fresh Basket",
      merchantName: "Fresh Basket",
      categoryId: "category_shopping",
      reference: "UPI-FB-2350",
      transactionAt: at("2026-09-10"),
      status: "completed",
      metadataJson: { seeded: true, channel: "UPI" },
    },
    {
      id: "tx_2026_09_msedcl",
      accountId: accountSavings,
      type: "bill",
      direction: "debit",
      amount: money(1650),
      currency: "INR",
      description: "Electricity bill payment",
      merchantName: "MSEDCL",
      categoryId: "category_utilities",
      reference: "UPI-MSEDCL-1650",
      transactionAt: at("2026-09-11"),
      status: "completed",
      metadataJson: { seeded: true, channel: "UPI" },
    },
    {
      id: "tx_2026_09_pending_grocery",
      accountId: accountSavings,
      type: "purchase",
      direction: "debit",
      amount: money(1200),
      currency: "INR",
      description: "Pending online delivery",
      merchantName: "Fresh Basket",
      categoryId: "category_food",
      reference: "PENDING-UPI-1200",
      transactionAt: new Date("2026-09-11T14:30:00.000Z"),
      status: "pending",
      metadataJson: { seeded: true, channel: "UPI" },
    },
    {
      id: "tx_2026_09_failed_transfer",
      accountId: accountSavings,
      type: "transfer",
      direction: "debit",
      amount: money(50000),
      currency: "INR",
      description: "Transfer to Rohan Shah (Limit Exceeded)",
      merchantName: "Rohan Shah",
      categoryId: "category_transfer",
      reference: "FAILED-NEFT-50000",
      transactionAt: at("2026-09-06"),
      status: "failed",
      metadataJson: { seeded: true, channel: "NEFT" },
    },
  ];

  rows.push(...featuredTransactions);

  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(Date.UTC(2025, 10 + month, 1, 10));
    const monthKey = `${monthDate.getUTCFullYear()}_${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    rows.push({ id: `tx_${monthKey}_salary`, accountId: accountCurrent, type: "salary", direction: "credit", amount: money(75000), currency: "INR", description: "Monthly salary credit", merchantName: "IDBI Payroll", categoryId: "category_salary", reference: `SAL-${monthKey}`, transactionAt: new Date(monthDate.getTime() + 2 * 86400000), status: "completed", metadataJson: { seeded: true } });
    const expenses = [
      ["food", 2400, "Fresh Basket", "Food & dining purchase"],
      ["food", 1850, "Cafe Coffee Day", "Food & dining purchase"],
      ["shopping", 4200, "Online Marketplace", "Shopping purchase"],
      ["utilities", 3200, "Utility bill", "Electricity and utility bill"],
      ["transport", 1250, "Metro and fuel", "Transport expense"],
      ["other", 899, "StreamFlix", "Monthly subscription"],
      ["transfer", 5000, "Sunita Sharma", "Demo transfer"],
      ["cash", 3000, "IDBI ATM", "ATM withdrawal"],
    ] as const;
    expenses.forEach(([category, amount, merchantName, description], index) => {
      rows.push({ id: `tx_${monthKey}_${index}`, accountId: accountSavings, type: category === "transfer" ? "transfer" : category === "cash" ? "cash" : category === "utilities" ? "bill" : "purchase", direction: "debit", amount: money(amount + month * 15), currency: "INR", description, merchantName, categoryId: `category_${category}`, reference: `DEMO-${monthKey}-${index}`, transactionAt: new Date(monthDate.getTime() + (4 + index) * 86400000), status: "completed", metadataJson: { seeded: true, channel: category === "cash" ? "ATM" : category === "transfer" ? "IMPS" : "UPI" } });
    });
    rows.push({ id: `tx_${monthKey}_refund`, accountId: accountSavings, type: "refund", direction: "credit", amount: money(850), currency: "INR", description: "Refund received", merchantName: "Online Marketplace", categoryId: "category_refund", reference: `REF-${monthKey}`, transactionAt: new Date(monthDate.getTime() + 16 * 86400000), status: "completed", metadataJson: { seeded: true } });
    rows.push({ id: `tx_${monthKey}_interest`, accountId: accountSavings, type: "interest", direction: "credit", amount: money(125), currency: "INR", description: "Savings interest", merchantName: "IDBI Bank", categoryId: "category_other", reference: `INT-${monthKey}`, transactionAt: new Date(monthDate.getTime() + 28 * 86400000), status: "completed", metadataJson: { seeded: true } });
  }
  return rows;
}

export async function seedDemoData() {
  await db.transaction(async (tx) => {
    const demoUserIds = [userA, userB];
    // Only synthetic demo users are removed. Foreign keys cascade their
    // accounts, transactions, goals, Coach records, and other user data.
    // Global catalog/category rows are retained for real customers.
    await tx.delete(auditEvents).where(inArray(auditEvents.userId, demoUserIds));
    await tx.delete(serviceFavorites).where(inArray(serviceFavorites.userId, demoUserIds));
    await tx.delete(users).where(inArray(users.id, demoUserIds));

    await tx.insert(users).values([
      { id: userA, externalAuthId: "demo-customer-a", email: "demo.a@example.test", status: "active" },
      { id: userB, externalAuthId: "demo-customer-b", email: "demo.b@example.test", status: "active" },
    ]);
    await tx.insert(profiles).values([
      { id: "profile_demo_a", userId: userA, firstName: "Aarav", lastName: "Mehta", displayName: "Aarav Mehta", preferredCurrency: "INR", preferredLanguage: "en-IN" },
      { id: "profile_demo_b", userId: userB, firstName: "Demo", lastName: "Customer", displayName: "Demo Customer", preferredCurrency: "INR", preferredLanguage: "en-IN" },
    ]);
    await tx.insert(accounts).values([
      { id: accountSavings, userId: userA, accountType: "savings", nickname: "Savings Account", maskedAccountNumber: "•••• 1234", currency: "INR", isPrimary: true, status: "active", branchName: "IDBI Mumbai Main", ifsc: "IBKL0000123" },
      { id: accountCurrent, userId: userA, accountType: "current", nickname: "Current Account", maskedAccountNumber: "•••• 5678", currency: "INR", isPrimary: false, status: "active", branchName: "IDBI Mumbai Main", ifsc: "IBKL0000123" },
      { id: accountFd, userId: userA, accountType: "fixed_deposit", nickname: "Fixed Deposit", maskedAccountNumber: "•••• 9012", currency: "INR", isPrimary: false, status: "active", branchName: "IDBI Mumbai Main", ifsc: "IBKL0000123" },
      { id: accountRd, userId: userA, accountType: "recurring_deposit", nickname: "Recurring Deposit", maskedAccountNumber: "•••• 3456", currency: "INR", isPrimary: false, status: "active", branchName: "IDBI Mumbai Main", ifsc: "IBKL0000123" },
    ]);
    await tx.insert(accountBalances).values([
      { id: "bal_demo_savings", accountId: accountSavings, ledgerBalance: money(101250), availableBalance: money(100000), holds: money(1250), currency: "INR", asOf: now },
      { id: "bal_demo_current", accountId: accountCurrent, ledgerBalance: money(125000), availableBalance: money(125000), holds: money(0), currency: "INR", asOf: now },
      { id: "bal_demo_fd", accountId: accountFd, ledgerBalance: money(70678), availableBalance: money(0), holds: money(0), currency: "INR", asOf: now },
      { id: "bal_demo_rd", accountId: accountRd, ledgerBalance: money(50000), availableBalance: money(0), holds: money(0), currency: "INR", asOf: now },
    ]);
    await tx.insert(transactionCategories).values(categories.map(([id, slug, name, type, iconKey]) => ({ id, slug, name, type, iconKey }))).onConflictDoNothing();
    await tx.insert(transactions).values(transactionRows());
    await tx.insert(beneficiaries).values([
      { id: "ben_sunita", userId: userA, type: "bank", name: "Sunita Sharma", nickname: "Sunita", maskedAccountNumber: "•••• 7890", ifsc: "IBKL0000456", status: "active" },
      { id: "ben_new_recipient", userId: userA, type: "bank", name: "New recipient", maskedAccountNumber: "•••• 3210", ifsc: "IBKL0000789", status: "cooling_off", coolingOffUntil: new Date(now.getTime() + 20 * 60 * 60 * 1000) },
      { id: "ben_aarav_upi", userId: userA, type: "upi", name: "Aarav Demo UPI", nickname: "Aarav UPI", upiId: "success@demo", status: "active" },
    ]);
    await tx.insert(transfers).values([
      { id: "transfer_completed", userId: userA, sourceAccountId: accountSavings, beneficiaryId: "ben_sunita", transferType: "imps", amount: money(5000), currency: "INR", note: "Monthly household transfer", status: "completed", demoTransaction: true, reference: "IDB-DEMO-5000", submittedAt: at("2026-09-04"), completedAt: at("2026-09-04") },
      { id: "transfer_failed", userId: userA, sourceAccountId: accountSavings, beneficiaryId: "ben_sunita", transferType: "upi", amount: money(250000), currency: "INR", status: "failed", demoTransaction: true, reference: "IDB-DEMO-FAILED", submittedAt: at("2026-08-20") },
      { id: "transfer_submitted", userId: userA, sourceAccountId: accountCurrent, beneficiaryId: "ben_aarav_upi", transferType: "upi", amount: money(1800), currency: "INR", status: "submitted", demoTransaction: true, reference: "IDB-DEMO-SUBMITTED", submittedAt: at("2026-09-10") },
    ]);
    await tx.insert(transferEvents).values([
      { id: "event_completed_draft", transferId: "transfer_completed", status: "draft", message: "Transfer draft created.", createdAt: at("2026-09-04") },
      { id: "event_completed_done", transferId: "transfer_completed", status: "completed", message: "Demo transfer completed.", createdAt: at("2026-09-04") },
      { id: "event_failed", transferId: "transfer_failed", status: "failed", message: "Demo balance was insufficient.", createdAt: at("2026-08-20") },
      { id: "event_submitted", transferId: "transfer_submitted", status: "submitted", message: "Demo transfer submitted.", createdAt: at("2026-09-10") },
    ]);
    await tx.insert(cards).values([
      { id: "card_primary_debit", userId: userA, accountId: accountSavings, cardType: "debit", network: "visa", maskedCardNumber: "•••• 4321", nickname: "Primary Debit Card", status: "active", expiryMonth: 12, expiryYear: 2029, isPrimary: true },
      { id: "card_virtual_debit", userId: userA, accountId: accountCurrent, cardType: "virtual", network: "rupay", maskedCardNumber: "•••• 9876", nickname: "Virtual Debit Card", status: "active", expiryMonth: 6, expiryYear: 2028, isPrimary: false },
    ]);
    await tx.insert(cardControls).values([
      { id: "controls_primary", cardId: "card_primary_debit", domesticEnabled: true, internationalEnabled: false, onlineEnabled: true, contactlessEnabled: true, atmEnabled: true, dailyPosLimit: money(50000), dailyOnlineLimit: money(25000), dailyAtmLimit: money(20000) },
      { id: "controls_virtual", cardId: "card_virtual_debit", domesticEnabled: true, internationalEnabled: false, onlineEnabled: true, contactlessEnabled: false, atmEnabled: false, dailyPosLimit: money(30000), dailyOnlineLimit: money(15000), dailyAtmLimit: money(0) },
    ]);
    await tx.insert(cardTransactions).values([
      { id: "card_tx_grocery", cardId: "card_primary_debit", merchantName: "Fresh Basket", amount: money(2400), currency: "INR", status: "completed", transactionAt: at("2026-09-07") },
      { id: "card_tx_fuel", cardId: "card_primary_debit", merchantName: "Metro Fuel", amount: money(1600), currency: "INR", status: "completed", transactionAt: at("2026-09-03") },
      { id: "card_tx_subscription", cardId: "card_virtual_debit", merchantName: "StreamFlix", amount: money(899), currency: "INR", status: "completed", transactionAt: at("2026-09-01") },
    ]);
    await tx.insert(notifications).values([
      { id: "notification_money_received", userId: userA, type: "transaction", title: "Money received", message: "₹12,500 was credited to Savings ••••1234.", severity: "success", isRead: false, destinationRoute: "/(app)/(tabs)/accounts", destinationParamsJson: {} , createdAt: new Date("2026-09-11T05:12:00.000Z") },
      { id: "notification_transfer_completed", userId: userA, type: "transaction", title: "Transfer completed", message: "₹5,000 was sent to Sunita Sharma.", severity: "success", isRead: false, destinationRoute: "/(app)/transfers/history", destinationParamsJson: { transferId: "transfer_completed" }, createdAt: new Date("2026-09-11T02:42:00.000Z") },
      { id: "notification_coach_insight", userId: userA, type: "coach", title: "Wealth Coach insight", message: "Food & Dining spending is 18% above your recent average.", severity: "attention", isRead: false, destinationRoute: "/(app)/(tabs)/coach", destinationParamsJson: {}, createdAt: new Date("2026-09-10T08:00:00.000Z") },
      { id: "notification_login", userId: userA, type: "security", title: "New login detected", message: "A login was detected from a new device.", severity: "critical", isRead: true, destinationRoute: "/(app)/security", destinationParamsJson: {}, createdAt: new Date("2026-09-09T06:30:00.000Z") },
    ]);
    await tx.insert(notificationPreferences).values({ id: "prefs_demo_a", userId: userA, transactionsEnabled: true, securityEnabled: true, coachEnabled: true, servicesEnabled: true, pushEnabled: true, emailEnabled: false });
    await tx.insert(wealthGoals).values([
      { id: "goal_emergency_fund", userId: userA, type: "emergency_fund", title: "Emergency fund", targetAmount: money(100000), currentAmount: money(68000), currency: "INR", targetDate: "2027-03-31", monthlyContribution: money(8000), status: "active" },
      { id: "goal_retirement", userId: userA, type: "retirement", title: "Retirement planning", targetAmount: money(2500000), currentAmount: money(425000), currency: "INR", targetDate: "2045-12-31", monthlyContribution: money(15000), status: "active" },
    ]);
    await tx.insert(monthlyFinancialSnapshots).values(Array.from({ length: 6 }, (_, index) => {
      const month = new Date(Date.UTC(2026, 3 + index, 1));
      return { id: `snapshot_${month.toISOString().slice(0, 7)}`, userId: userA, month: month.toISOString().slice(0, 10), income: money(75000), expenses: money(54000 + index * 400), savings: money(21000 - index * 400), savingsRate: `${28 - index}.00`, spendingChangePercent: `${12 - index}.00`, goalProgressPercent: "68.00" };
    }));
    await tx.insert(financialInsights).values([
      { id: "insight_food_above_average", userId: userA, type: "spending", title: "Food & Dining is trending higher", summary: "Food & Dining spending is 18% above your recent average.", severity: "attention", metricValue: "18.00", metricUnit: "%", comparisonValue: "18.00", comparisonPeriod: "recent average", sourceJson: { category: "food_dining", period: "2026-09" }, actionRoute: "/(app)/activity", expiresAt: new Date("2027-01-01T00:00:00.000Z") },
      { id: "insight_savings_rate", userId: userA, type: "savings", title: "Your savings rate is steady", summary: "You saved 28% of income in the latest monthly snapshot.", severity: "positive", metricValue: "28.00", metricUnit: "%", sourceJson: { snapshot: "2026-09" }, actionRoute: "/(app)/(tabs)/coach", expiresAt: new Date("2027-01-01T00:00:00.000Z") },
      { id: "insight_emergency_goal", userId: userA, type: "goal", title: "Emergency fund is 68% complete", summary: "You are ₹32,000 away from completing your emergency fund goal.", severity: "neutral", metricValue: "68.00", metricUnit: "%", sourceJson: { goalId: "goal_emergency_fund" }, actionRoute: "/(app)/coach/recommendations", expiresAt: new Date("2027-01-01T00:00:00.000Z") },
    ]);
    await tx.insert(coachConversations).values([
      { id: "conversation_laptop", userId: userA, title: "Can I afford a new laptop?", status: "active", createdAt: at("2026-09-07"), updatedAt: at("2026-09-07") },
      { id: "conversation_spending", userId: userA, title: "Where did I spend the most?", status: "active", createdAt: at("2026-09-05"), updatedAt: at("2026-09-06") },
      { id: "conversation_savings", userId: userA, title: "Help me improve my savings", status: "active", createdAt: at("2026-09-02"), updatedAt: at("2026-09-03") },
    ]);
    await tx.insert(coachMessages).values([
      { id: "message_laptop_user", conversationId: "conversation_laptop", role: "user", content: "Can I afford a new laptop?", createdAt: at("2026-09-07") },
      { id: "message_laptop_assistant", conversationId: "conversation_laptop", role: "assistant", content: "Your demo balances suggest reviewing the purchase against your emergency fund first.", structuredPayloadJson: { sources: [{ type: "financial_context", period: "recent" }] }, createdAt: new Date("2026-09-07T10:01:00.000Z") },
      { id: "message_spending_user", conversationId: "conversation_spending", role: "user", content: "Where did I spend the most?", createdAt: at("2026-09-05") },
      { id: "message_spending_assistant", conversationId: "conversation_spending", role: "assistant", content: "Food & Dining is one of your highest recent categories in this demo.", createdAt: at("2026-09-06") },
      { id: "message_savings_user", conversationId: "conversation_savings", role: "user", content: "Help me improve my savings", createdAt: at("2026-09-02") },
      { id: "message_savings_assistant", conversationId: "conversation_savings", role: "assistant", content: "A small monthly transfer into your emergency fund can help you stay consistent.", createdAt: at("2026-09-03") },
    ]);
    await tx.insert(serviceCatalog).values(services.map(([id, slug, title, description, category, iconKey, iconTone, route, searchTermsJson], displayOrder) => ({ id, slug, title, description, category, iconKey, iconTone, route, isActive: true, displayOrder, searchTermsJson: [...searchTermsJson] }))).onConflictDoNothing();
    await tx.insert(serviceFavorites).values([
      { id: "favorite_transfer", userId: userA, serviceId: "svc_transfer_money" },
      { id: "favorite_coach", userId: userA, serviceId: "svc_wealth_coach" },
    ]);
  });
  console.log(`Seeded IDBI demo data: ${transactionRows().length} transactions and ${services.length} services.`);
}

if (process.argv[1]?.includes("src/db/seed.")) {
  try {
    await seedDemoData();
  } finally {
    await closeDatabase();
  }
}
