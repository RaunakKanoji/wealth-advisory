import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AccountQuickActions,
  AccountsListCard,
  AccountsScreenHeader,
  AccountsSkeletons,
  OpenAccountCard,
  TotalBalanceSummary,
} from "@/components/accounts";
import { demoAccounts } from "@/data/accounts-demo-data";
import type { BankAccount } from "@/types/banking";

type AccountsLoadState = "loading" | "ready" | "error";
type AccountActionRoute =
  | "/(app)/accounts/statements"
  | "/(app)/accounts/details"
  | "/(app)/accounts/manage-card"
  | "/(app)/accounts/actions";

export default function AccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isLoaded: isAuthLoaded, isSignedIn, sessionId } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loadState, setLoadState] = useState<AccountsLoadState>("loading");
  const [isTotalBalanceVisible, setIsTotalBalanceVisible] = useState(true);

  const loadAccounts = useCallback(() => {
    setLoadState("loading");
    setAccounts([]);

    const timer = setTimeout(() => {
      setAccounts(demoAccounts);
      setLoadState("ready");
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setAccounts([]);
      setLoadState("loading");
      return;
    }

    return loadAccounts();
  }, [isAuthLoaded, isSignedIn, sessionId, loadAccounts]);

  useEffect(() => {
    setIsTotalBalanceVisible(true);
  }, [isSignedIn, sessionId]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  );
  const selectedAccount = accounts[0];
  const horizontalPadding = width < 375 ? 16 : 20;
  const isTablet = width >= 768;
  const tabBarHeight = Platform.select({
    ios: 72 + insets.bottom,
    android: 66 + Math.max(insets.bottom, 10),
    default: 76,
  });

  const openAccount = (account: BankAccount) => {
    router.push({
      pathname: "/(app)/accounts/[accountId]",
      params: { accountId: account.id },
    });
  };

  const openSelectedAccountRoute = (pathname: AccountActionRoute) => {
    if (!selectedAccount) {
      return;
    }

    router.push({
      pathname,
      params: { accountId: selectedAccount.id },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.contentInner,
            {
              maxWidth: isTablet ? 720 : undefined,
              paddingHorizontal: horizontalPadding,
              paddingBottom: 40 + tabBarHeight,
            },
          ]}
        >
          <AccountsScreenHeader
            onAddPress={() => router.push("/(app)/accounts/add")}
          />

          {loadState === "loading" || !isAuthLoaded ? (
            <AccountsSkeletons />
          ) : loadState === "error" ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>We couldn’t load your accounts.</Text>
              <Text style={styles.errorDescription}>
                Please check your connection and try again.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading accounts"
                onPress={loadAccounts}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No accounts found</Text>
              <Text style={styles.emptyDescription}>
                Your eligible IDBI Bank accounts will appear here once linked.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Account"
                onPress={() => router.push("/(app)/accounts/add")}
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>Add Account</Text>
              </Pressable>
              <OpenAccountCard
                onPress={() => router.push("/(app)/accounts/open-new")}
              />
            </View>
          ) : !selectedAccount ? null : (
            <View>
              <View style={styles.sectionGap}>
                <TotalBalanceSummary
                  balance={totalBalance}
                  accountCount={accounts.length}
                  isVisible={isTotalBalanceVisible}
                  onToggleVisibility={() =>
                    setIsTotalBalanceVisible((visible) => !visible)
                  }
                  onPress={() => router.push("/(app)/accounts/summary")}
                />
              </View>

              <View style={styles.quickActionsGap}>
                <AccountQuickActions
                  account={selectedAccount}
                  onStatementPress={() =>
                    openSelectedAccountRoute("/(app)/accounts/statements")
                  }
                  onDetailsPress={() =>
                    openSelectedAccountRoute("/(app)/accounts/details")
                  }
                  onManageCardPress={() =>
                    openSelectedAccountRoute("/(app)/accounts/manage-card")
                  }
                  onMoreActionsPress={() =>
                    openSelectedAccountRoute("/(app)/accounts/actions")
                  }
                />
              </View>

              <View style={styles.listGap}>
                <AccountsListCard
                  accounts={accounts}
                  onAccountPress={openAccount}
                />
              </View>

              <View style={styles.promoGap}>
                <OpenAccountCard
                  onPress={() => router.push("/(app)/accounts/open-new")}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  scrollContent: {
    width: "100%",
  },
  contentInner: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 24,
  },
  sectionGap: {
    marginTop: 4,
  },
  quickActionsGap: {
    marginTop: 27,
  },
  listGap: {
    marginTop: 34,
  },
  promoGap: {
    marginTop: 24,
  },
  errorCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EBEF",
  },
  errorTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorDescription: {
    marginTop: 8,
    color: "#687386",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#006A4E",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EBEF",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    maxWidth: 300,
    marginTop: 8,
    color: "#687386",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  emptyButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: "#006A4E",
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.78,
  },
});
