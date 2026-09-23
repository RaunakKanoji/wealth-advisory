import { TransactionExplorerScreen } from "@/components/transactions/transaction-explorer-screen";

export default function AccountStatementsScreen() {
  return (
    <TransactionExplorerScreen
      title="Statements"
      subtitle="Review and export account activity. Exports are clearly marked as summaries, not official bank statements."
    />
  );
}
