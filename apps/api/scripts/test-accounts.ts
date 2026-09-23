import { closeDatabase } from "../src/db/client.js";
import * as accountsService from "../src/services/accounts.service.js";

try {
  const result = await accountsService.listAccounts("usr_demo_a");
  console.log("[AUTH] user resolved: usr_demo_a");
  console.log(`[ACCOUNTS] accounts found: ${result.accounts.length}`);
  console.log(`[ACCOUNTS] total balance: ${result.summary.totalBalance}`);
  console.log(`[ACCOUNTS] available to spend: ${result.summary.availableToSpend}`);
  console.log(`[ACCOUNTS] deposits: ${result.summary.deposits}`);
  if (result.accounts.length !== 4 || result.summary.totalBalance !== "345678.00" || result.summary.availableToSpend !== "225000.00" || result.summary.deposits !== "120678.00") {
    throw new Error("Seeded account data did not match the expected demo slice.");
  }
} finally {
  await closeDatabase();
}
