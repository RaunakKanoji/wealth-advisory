import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AAConnectCard } from "@/components/accounts";
import { accountColors } from "@/components/accounts/tokens";
import { PageHeader, StateCard, Surface } from "@/components/design-system";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBanner } from "@/components/status-banner";
import { appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import type { AAConsentRequest } from "@/lib/api/aa";
import { apiErrorMessage } from "@/lib/api/client";
import { useAAConsents, useCreateAAConsent, useSyncAAConsent } from "@/lib/api/hooks";
import type { AAConsent } from "@/lib/api/types";
import {
  env,
  isExplicitDemoAuthEnabled,
  isFinancialAuthReady,
  isRemoteDataEnabled,
} from "@/lib/env";

type Notice = {
  action: "open" | "sync" | null;
  message: string;
  title: string;
  tone: "info" | "warning" | "danger";
};

const CONSENT_REQUEST: AAConsentRequest = {
  purposeCode: "101",
  purposeText: "Personal financial management and wealth advisory",
  fiTypes: ["DEPOSIT"],
  fiSections: ["PROFILE", "SUMMARY", "TRANSACTIONS"],
  accountIds: [],
  fetchType: "ONETIME",
  fetchFrequency: "1",
  consentMode: "STORE",
  consentDurationDays: 365,
  dataLifeDays: 30,
};

const resumableStatuses = new Set(["active", "paused", "pending", "requested"]);

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function consentNotice(consent: AAConsent): Notice {
  const status = normalizeStatus(consent.status);
  if (status === "active") {
    return {
      action: "sync",
      message: "Your approval is ready. Import the linked account information into My Accounts.",
      title: "Consent approved",
      tone: "info",
    };
  }
  if (status === "paused") {
    return {
      action: "sync",
      message: "Check with your Account Aggregator to see whether this consent can continue.",
      title: "Consent paused",
      tone: "warning",
    };
  }
  if (status === "pending" || status === "requested") {
    return {
      action: "sync",
      message: "Complete approval with your Account Aggregator, then check the connection.",
      title: "Approval pending",
      tone: "info",
    };
  }
  return {
    action: null,
    message: "Start a new Account Aggregator request to link an account.",
    title: status === "expired" ? "Previous consent expired" : "Previous link was not completed",
    tone: "warning",
  };
}

export default function AddAccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoaded, isSignedIn, userId } = useAuth({ treatPendingAsSignedOut: false });
  const consentsQuery = useAAConsents();
  const createConsent = useCreateAAConsent();
  const syncConsent = useSyncAAConsent();
  const [currentConsent, setCurrentConsent] = useState<AAConsent | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  const ownerScope = isExplicitDemoAuthEnabled
    ? `demo:${env.EXPO_PUBLIC_DEMO_AUTH_ID}`
    : userId ?? "signed-out";
  const ownerScopeRef = useRef(ownerScope);
  const previousOwnerScope = useRef(ownerScope);
  const redirectUrlRef = useRef<string | null>(null);
  const flowOwnerScope = useRef(ownerScope);
  ownerScopeRef.current = ownerScope;

  useEffect(() => {
    if (previousOwnerScope.current === ownerScope) return;
    previousOwnerScope.current = ownerScope;
    flowOwnerScope.current = ownerScope;
    setCurrentConsent(null);
    setRedirectUrl(null);
    redirectUrlRef.current = null;
    setNotice(null);
    setIsBrowserOpen(false);
    createConsent.reset();
    syncConsent.reset();
  }, [createConsent, ownerScope, syncConsent]);

  const latestConsent = consentsQuery.data?.items[0] ?? null;
  const resumableConsent = useMemo(
    () => consentsQuery.data?.items.find((item) => resumableStatuses.has(normalizeStatus(item.status))) ?? null,
    [consentsQuery.data?.items],
  );
  const isCurrentOwnerFlow = flowOwnerScope.current === ownerScope;
  const selectedConsent = (isCurrentOwnerFlow ? currentConsent : null) ?? resumableConsent;
  const visibleNotice = (isCurrentOwnerFlow ? notice : null) ?? (selectedConsent
    ? consentNotice(selectedConsent)
    : latestConsent
      ? consentNotice(latestConsent)
      : null);
  const authReady = isFinancialAuthReady(isLoaded, isSignedIn);
  const isBusy = createConsent.isPending || syncConsent.isPending || isBrowserOpen;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/accounts");
  }, [router]);

  const checkConnection = useCallback(async (consentId: string, operationOwner = ownerScopeRef.current) => {
    if (syncConsent.isPending) return;
    flowOwnerScope.current = operationOwner;
    setNotice({
      action: null,
      message: "Confirming approval and requesting the latest account information.",
      title: "Checking connection",
      tone: "info",
    });
    try {
      const result = await syncConsent.mutateAsync(consentId);
      if (ownerScopeRef.current !== operationOwner) return;
      setCurrentConsent(result.consent);

      if (result.session?.status.toLowerCase() === "completed") {
        router.replace("/(app)/(tabs)/accounts");
        return;
      }
      if (result.session) {
        setNotice({
          action: "sync",
          message: "Approval was received. Account information is still being prepared; check again shortly.",
          title: "Account import in progress",
          tone: "info",
        });
        return;
      }
      setNotice({
        action: redirectUrlRef.current ? "open" : "sync",
        message: "Approval is still pending. Complete consent with your Account Aggregator, then check again.",
        title: "Approval pending",
        tone: "warning",
      });
    } catch (error) {
      if (ownerScopeRef.current !== operationOwner) return;
      setNotice({
        action: "sync",
        message: apiErrorMessage(error, "The Account Aggregator connection"),
        title: "Couldn’t confirm the connection",
        tone: "danger",
      });
    }
  }, [router, syncConsent]);

  const openConsent = useCallback(async (url: string, consentId: string, operationOwner = ownerScopeRef.current) => {
    if (isBrowserOpen) return;
    setIsBrowserOpen(true);
    try {
      await WebBrowser.openBrowserAsync(url);
      if (ownerScopeRef.current !== operationOwner) return;
      // Android Custom Tabs and web resolve as soon as the browser opens, not
      // when consent is complete. Let the customer return before checking.
      if (Platform.OS === "android" || Platform.OS === "web") {
        setNotice({
          action: "sync",
          message: "Complete approval in your Account Aggregator, then return here and check the connection.",
          title: "Consent page opened",
          tone: "info",
        });
        return;
      }
      await checkConnection(consentId, operationOwner);
    } catch {
      if (ownerScopeRef.current !== operationOwner) return;
      setNotice({
        action: "open",
        message: "The consent page could not be opened. Your request is saved, so you can try opening it again.",
        title: "Couldn’t open Account Aggregator",
        tone: "danger",
      });
    } finally {
      if (ownerScopeRef.current === operationOwner) setIsBrowserOpen(false);
    }
  }, [checkConnection, isBrowserOpen]);

  const startLinking = useCallback(async () => {
    if (!isRemoteDataEnabled || !authReady || isBusy) return;
    const operationOwner = ownerScopeRef.current;
    flowOwnerScope.current = operationOwner;
    setNotice(null);
    setRedirectUrl(null);
    redirectUrlRef.current = null;
    try {
      const created = await createConsent.mutateAsync(CONSENT_REQUEST);
      if (ownerScopeRef.current !== operationOwner) return;
      setCurrentConsent(created.consent);
      setRedirectUrl(created.redirectUrl);
      redirectUrlRef.current = created.redirectUrl;

      // The explicit backend mock approves consent immediately and supplies a
      // non-routable example URL. Real pending consents continue in the AA page.
      if (normalizeStatus(created.consent.status) === "active") {
        await checkConnection(created.consent.id, operationOwner);
      } else if (Platform.OS === "web") {
        // Opening from the follow-up press preserves web user activation and
        // avoids the provider page being suppressed by a popup blocker.
        setNotice({
          action: "open",
          message: "Open your Account Aggregator to review and approve this one-time request.",
          title: "Consent request ready",
          tone: "info",
        });
      } else {
        await openConsent(created.redirectUrl, created.consent.id, operationOwner);
      }
    } catch (error) {
      if (ownerScopeRef.current !== operationOwner) return;
      setNotice({
        action: null,
        message: apiErrorMessage(error, "Account linking"),
        title: "Couldn’t start account linking",
        tone: "danger",
      });
    }
  }, [authReady, checkConnection, createConsent, isBusy, openConsent]);

  const runNoticeAction = useCallback(() => {
    if (!selectedConsent || isBusy) return;
    if (visibleNotice?.action === "open" && redirectUrl) {
      void openConsent(redirectUrl, selectedConsent.id);
      return;
    }
    void checkConnection(selectedConsent.id);
  }, [checkConnection, isBusy, openConsent, redirectUrl, selectedConsent, visibleNotice?.action]);

  return (
    <ScreenContainer scroll edges={["top", "bottom"]} backgroundColor={accountColors.background}>
      <View
        style={[
          styles.container,
          {
            maxWidth: width >= 768 ? 760 : undefined,
            paddingHorizontal: width < 375 ? appSpacing.lg : appSpacing.xl,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Back to accounts"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={23} color={accountColors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <PageHeader
          subtitle="Connect eligible accounts securely through Account Aggregator"
          title="Link bank account"
        />

        {!isRemoteDataEnabled ? (
          <StateCard
            actionAccessibilityLabel="Back to My Accounts"
            actionLabel="Back to Accounts"
            description="Account linking is available when the secure banking service is connected. Local demo data cannot create Account Aggregator consent."
            iconName="link-outline"
            onAction={goBack}
            title="Account linking unavailable"
          />
        ) : !authReady ? (
          <View accessible accessibilityLabel="Preparing secure account linking" style={styles.loadingCard}>
            <ActivityIndicator color={accountColors.brandGreenDark} />
            <Text style={styles.loadingText}>Preparing secure account linking…</Text>
          </View>
        ) : (
          <>
            <AAConnectCard isLoading={isBusy} onConnect={() => void startLinking()} />

            {visibleNotice ? (
              <View style={styles.statusSection}>
                <StatusBanner
                  actionAccessibilityLabel={visibleNotice.action === "open"
                    ? "Open Account Aggregator consent"
                    : "Check Account Aggregator connection"}
                  actionLabel={!isBusy && visibleNotice.action
                    ? visibleNotice.action === "open"
                      ? "Open consent"
                      : normalizeStatus(selectedConsent?.status ?? "") === "active"
                        ? "Import"
                        : "Check status"
                    : undefined}
                  iconName={visibleNotice.tone === "danger" ? "alert-circle-outline" : "shield-checkmark-outline"}
                  message={visibleNotice.message}
                  onAction={!isBusy && visibleNotice.action ? runNoticeAction : undefined}
                  title={visibleNotice.title}
                  tone={visibleNotice.tone}
                />
              </View>
            ) : consentsQuery.isLoading ? (
              <View accessible accessibilityLabel="Loading Account Aggregator consent status" style={styles.inlineLoading}>
                <ActivityIndicator color={accountColors.brandGreenDark} size="small" />
                <Text style={styles.inlineLoadingText}>Checking existing consent…</Text>
              </View>
            ) : consentsQuery.error ? (
              <View style={styles.statusSection}>
                <StatusBanner
                  actionLabel="Retry"
                  iconName="cloud-offline-outline"
                  message={apiErrorMessage(consentsQuery.error, "Consent status")}
                  onAction={() => void consentsQuery.refetch()}
                  title="Couldn’t load consent status"
                  tone="warning"
                />
              </View>
            ) : null}

            <Surface style={styles.scopeCard} variant="subtle">
              <Text accessibilityRole="header" style={styles.scopeTitle}>What you’ll share</Text>
              <ScopeRow icon="wallet-outline" label="Deposit account profile and balances" />
              <ScopeRow icon="receipt-outline" label="Transactions for the requested period" />
              <ScopeRow icon="checkmark-circle-outline" label="One-time access that you approve with your Account Aggregator" />
            </Surface>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function ScopeRow({ icon, label }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={styles.scopeRow}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.scopeIcon}
      >
        <Ionicons name={icon} size={18} color={accountColors.brandGreenDark} />
      </View>
      <Text style={styles.scopeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "center",
    paddingTop: appSpacing.md,
    paddingBottom: appSpacing.xxxl,
  },
  backButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: appSpacing.md,
    marginLeft: -appSpacing.sm,
    paddingHorizontal: appSpacing.sm,
    borderRadius: appRadii.control,
  },
  backText: {
    marginLeft: 2,
    color: accountColors.textPrimary,
    ...appTypography.supporting,
    fontWeight: "600",
  },
  loadingCard: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: appSpacing.xl,
    borderRadius: appRadii.card,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
  },
  loadingText: {
    marginTop: appSpacing.md,
    color: accountColors.textSecondary,
    ...appTypography.supporting,
  },
  statusSection: {
    marginBottom: appSpacing.lg,
  },
  inlineLoading: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: appSpacing.lg,
    paddingHorizontal: appSpacing.md,
    borderRadius: appRadii.medium,
    backgroundColor: accountColors.brandGreenSoft,
  },
  inlineLoadingText: {
    marginLeft: appSpacing.sm,
    color: accountColors.textSecondary,
    ...appTypography.supporting,
  },
  scopeCard: {
    padding: appSpacing.lg,
  },
  scopeTitle: {
    marginBottom: appSpacing.sm,
    color: accountColors.textPrimary,
    ...appTypography.cardTitle,
    fontWeight: "700",
  },
  scopeRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  scopeIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: appSpacing.md,
    borderRadius: appRadii.round,
    backgroundColor: accountColors.brandGreenSoft,
  },
  scopeLabel: {
    flex: 1,
    minWidth: 0,
    color: accountColors.textSecondary,
    ...appTypography.supporting,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
