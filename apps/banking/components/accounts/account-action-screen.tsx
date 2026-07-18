import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { demoAccounts } from "@/data/accounts-demo-data";
import { formatIndianCurrency } from "@/lib/currency";
import { ScreenContainer } from "@/components/screen-container";

import { accountColors } from "./tokens";

type AccountActionScreenProps = {
  title: string;
  description: string;
  actionLabel?: string;
  allowAccountSelection?: boolean;
};

const ALL_ACCOUNTS_ID = "all-accounts";

function getAccountId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AccountActionScreen({
  title,
  description,
  actionLabel = "Go Back",
  allowAccountSelection = false,
}: AccountActionScreenProps) {
  const router = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{
    accountId?: string | string[];
  }>();
  const accountId = getAccountId(rawAccountId);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(
    allowAccountSelection ? accountId ?? ALL_ACCOUNTS_ID : accountId,
  );
  const selectedAccount = demoAccounts.find(
    (item) => item.id === selectedAccountId,
  );
  const allAccountsBalance = useMemo(
    () => demoAccounts.reduce((sum, item) => sum + item.balance, 0),
    [],
  );
  const showAccountSummary = allowAccountSelection || Boolean(selectedAccount);
  const summaryName = selectedAccount?.name ?? "All Accounts";
  const summaryNumber = selectedAccount
    ? `Account ending in ${selectedAccount.lastFour}`
    : `${demoAccounts.length} linked accounts`;
  const summaryBalance = selectedAccount?.balance ?? allAccountsBalance;

  const selectAccount = (nextAccountId: string) => {
    setSelectedAccountId(nextAccountId);
    setIsAccountMenuOpen(false);
  };

  return (
    <ScreenContainer
      scroll
      edges={["top", "bottom"]}
      backgroundColor={accountColors.background}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={accountColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
          {allowAccountSelection ? (
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>Show statements for</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select account. Currently ${summaryName}`}
                accessibilityState={{ expanded: isAccountMenuOpen }}
                onPress={() => setIsAccountMenuOpen((open) => !open)}
                style={({ pressed }) => [
                  styles.selectorButton,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.selectorTextColumn}>
                  <Text style={styles.selectorValue}>{summaryName}</Text>
                  <Text style={styles.selectorSubtext}>{summaryNumber}</Text>
                </View>
                <Ionicons
                  name={isAccountMenuOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={accountColors.textSecondary}
                />
              </Pressable>

              {isAccountMenuOpen ? (
                <View style={styles.accountOptions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Show statements for all accounts"
                    accessibilityState={{
                      selected: selectedAccountId === ALL_ACCOUNTS_ID,
                    }}
                    onPress={() => selectAccount(ALL_ACCOUNTS_ID)}
                    style={({ pressed }) => [
                      styles.accountOption,
                      selectedAccountId === ALL_ACCOUNTS_ID &&
                        styles.selectedAccountOption,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.accountOptionText}>All Accounts</Text>
                    <Text style={styles.accountOptionSubtext}>
                      {demoAccounts.length} linked accounts
                    </Text>
                  </Pressable>
                  {demoAccounts.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Show statements for ${item.name}`}
                      accessibilityState={{ selected: item.id === selectedAccountId }}
                      onPress={() => selectAccount(item.id)}
                      style={({ pressed }) => [
                        styles.accountOption,
                        item.id === selectedAccountId &&
                          styles.selectedAccountOption,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.accountOptionText}>{item.name}</Text>
                      <Text style={styles.accountOptionSubtext}>
                        Account ending in {item.lastFour}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {showAccountSummary ? (
            <View style={styles.accountSummary}>
              <Text style={styles.accountName}>{summaryName}</Text>
              <Text style={styles.accountNumber}>{summaryNumber}</Text>
              <Text style={styles.accountBalance}>
                {formatIndianCurrency(summaryBalance)}
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  backText: {
    marginLeft: 4,
    color: accountColors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    marginTop: 24,
    padding: 24,
    borderRadius: 24,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    color: accountColors.textPrimary,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
  },
  description: {
    marginTop: 10,
    color: accountColors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  selectorSection: {
    marginTop: 24,
  },
  selectorLabel: {
    marginBottom: 8,
    color: accountColors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  selectorButton: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: accountColors.border,
  },
  selectorTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  selectorValue: {
    color: accountColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  selectorSubtext: {
    marginTop: 3,
    color: accountColors.textSecondary,
    fontSize: 13,
  },
  accountOptions: {
    marginTop: 8,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: accountColors.border,
  },
  accountOption: {
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: accountColors.border,
  },
  selectedAccountOption: {
    backgroundColor: accountColors.brandGreenSoft,
  },
  accountOptionText: {
    color: accountColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  accountOptionSubtext: {
    marginTop: 2,
    color: accountColors.textSecondary,
    fontSize: 13,
  },
  accountSummary: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: accountColors.brandGreenSoft,
  },
  accountName: {
    color: accountColors.brandGreenDark,
    fontSize: 17,
    fontWeight: "700",
  },
  accountNumber: {
    marginTop: 5,
    color: accountColors.textSecondary,
    fontSize: 14,
  },
  accountBalance: {
    marginTop: 12,
    color: accountColors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  actionButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: accountColors.brandGreenDark,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.78,
  },
});
