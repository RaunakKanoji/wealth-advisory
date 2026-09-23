import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { ScreenContainer } from "@/components/screen-container";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { StatusBanner } from "@/components/status-banner";
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { apiErrorMessage } from "@/lib/api/client";
import { useCoachReports, useCoachConversations } from "@/lib/api/hooks";
import type { CoachConversationsResponse } from "@/lib/api/types";
import { isRemoteCoachEnabled } from "@/lib/env";
import { privacySafeFinancialText } from "@/lib/privacy";

import { ConversationRow } from "./conversation-row";

type RemoteConversationSummary = CoachConversationsResponse["items"][number];

export function RemoteCoachHistoryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const reports = useCoachReports();
  const conversationsQuery = useCoachConversations(isRemoteCoachEnabled);
  const [searchState, setSearchState] = useState({ customerId, query: "" });
  const query = searchState.customerId === customerId ? searchState.query : "";
  const setQuery = useCallback((nextQuery: string) => {
    setSearchState({ customerId, query: nextQuery });
  }, [customerId]);
  const { balanceVisible, isBalanceVisibilityHydrated } = useBalanceVisibility(customerId, isUserLoaded);
  const horizontalPadding = width < 375 ? appSpacing.lg : appSpacing.xl;

  useEffect(() => {
    setSearchState({ customerId, query: "" });
  }, [customerId]);

  const conversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return [...(conversationsQuery.data?.items ?? [])]
      .filter((conversation) => {
        const searchableTitle = balanceVisible
          ? conversation.title
          : privacySafeFinancialText(conversation.title, "Financial question");
        return !normalizedQuery || searchableTitle.toLocaleLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [balanceVisible, conversationsQuery.data?.items, query]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)/coach");
  }, [router]);

  const openConversation = useCallback((conversationId: string) => {
    router.push({
      pathname: "/(app)/coach/chat",
      params: { conversationId },
    });
  }, [router]);

  const renderConversation = useCallback(({ item, index }: ListRenderItemInfo<RemoteConversationSummary>) => (
    <ConversationRow
      balanceVisible={balanceVisible}
      conversation={item}
      onPress={() => openConversation(item.id)}
      showDivider={index < conversations.length - 1}
    />
  ), [balanceVisible, conversations.length, openConversation]);

  const isLoading = !isUserLoaded
    || !isBalanceVisibilityHydrated
    || (!conversationsQuery.data && (conversationsQuery.isPending || conversationsQuery.isFetching));
  const hasInitialError = !conversationsQuery.data && conversationsQuery.isError;

  return (
    <ScreenContainer backgroundColor={appColors.background} edges={["top", "bottom"]}>
      <View style={styles.page}>
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Wealth Coach"
            accessibilityHint="Returns to the Wealth Coach overview"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
            <Text style={styles.backText}>Back to Coach</Text>
          </Pressable>

          {reports.data?.items.length ? <View style={{paddingVertical:12}}><Text style={{color:appColors.textSecondary,fontWeight:'600'}}>Saved summaries</Text>{reports.data.items.map(({report,message})=><Pressable key={report.id} accessibilityRole="button" onPress={()=>openConversation(message.conversationId)} style={{paddingVertical:10}}><Text style={{color:appColors.primary}}>{balanceVisible ? report.title : privacySafeFinancialText(report.title, "Saved summary")} · {new Date(report.createdAt).toLocaleDateString()}</Text></Pressable>)}</View> : null}
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text accessibilityRole="header" style={styles.title}>Coach history</Text>
              <Text style={styles.subtitle}>Continue a saved conversation with its full context.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new Coach conversation"
              onPress={() => router.push("/(app)/coach/new")}
              style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={19} color={appColors.surface} />
              <Text style={styles.newButtonText}>New chat</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.searchWrap, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={appColors.textMuted} />
            <TextInput
              accessibilityLabel="Search saved Coach conversations"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search conversations"
              placeholderTextColor={appColors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear conversation search"
                onPress={() => setQuery("")}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Ionicons name="close-circle" size={20} color={appColors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
            <HistorySkeleton />
          </View>
        ) : null}

        {!isLoading && hasInitialError ? (
          <View style={[styles.content, styles.centeredContent, { paddingHorizontal: horizontalPadding }]}>
            <View style={styles.errorIcon}>
              <Ionicons name="cloud-offline-outline" size={25} color={appColors.danger} />
            </View>
            <Text accessibilityRole="header" style={styles.stateTitle}>History unavailable</Text>
            <Text style={styles.stateDescription}>{apiErrorMessage(conversationsQuery.error, "Coach history")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading Coach history"
              onPress={() => void conversationsQuery.refetch()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              {conversationsQuery.isFetching ? <ActivityIndicator size="small" color={appColors.surface} /> : <Ionicons name="refresh-outline" size={18} color={appColors.surface} />}
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !hasInitialError ? (
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: horizontalPadding },
              conversations.length === 0 && styles.emptyListContent,
            ]}
            data={conversations}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(conversation) => conversation.id}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name={query ? "search-outline" : "chatbubble-ellipses-outline"} size={25} color={appColors.primary} />
                </View>
                <Text accessibilityRole="header" style={styles.stateTitle}>{query ? "No matching conversations" : "No conversations yet"}</Text>
                <Text style={styles.stateDescription}>{query ? "Try a different title." : "Ask your Wealth Coach a question to start a saved conversation."}</Text>
                {!query ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start a new Coach conversation"
                    onPress={() => router.push("/(app)/coach/new")}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={19} color={appColors.surface} />
                    <Text style={styles.primaryButtonText}>Start a conversation</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            ListHeaderComponent={conversationsQuery.data && conversationsQuery.isError ? (
              <View style={styles.listBanner}>
                <StatusBanner
                  actionLabel="Retry"
                  actionAccessibilityLabel="Retry refreshing Coach history"
                  iconName="refresh-outline"
                  message="Showing the last available conversation list."
                  onAction={() => void conversationsQuery.refetch()}
                  title="Couldn’t refresh"
                  tone="warning"
                />
              </View>
            ) : null}
            renderItem={renderConversation}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function HistorySkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View accessibilityLabel="Loading Coach history" style={styles.skeletonList}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton opacity={opacity} style={styles.skeletonIcon} />
          <View style={styles.skeletonCopy}>
            <Skeleton opacity={opacity} style={styles.skeletonTitle} />
            <Skeleton opacity={opacity} style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { paddingTop: appSpacing.sm, paddingBottom: appSpacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.divider },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { marginLeft: 2, color: appColors.textPrimary, ...appTypography.supporting, fontWeight: "600" },
  titleRow: { marginTop: appSpacing.sm, flexDirection: "row", alignItems: "center" },
  titleCopy: { flex: 1, minWidth: 0, marginRight: appSpacing.md },
  title: { color: appColors.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: "700" },
  subtitle: { marginTop: appSpacing.xs, color: appColors.textSecondary, ...appTypography.metadata },
  newButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: appSpacing.xs, paddingHorizontal: appSpacing.md, borderRadius: appRadii.control, backgroundColor: appColors.primary },
  newButtonText: { color: appColors.surface, ...appTypography.metadata, fontWeight: "700" },
  searchWrap: { paddingTop: appSpacing.lg, paddingBottom: appSpacing.sm },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingLeft: appSpacing.md, paddingRight: appSpacing.xs, borderRadius: appRadii.medium, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, marginLeft: appSpacing.sm, paddingVertical: appSpacing.sm, color: appColors.textPrimary, ...appTypography.supporting },
  clearButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  centeredContent: { alignItems: "center", justifyContent: "center" },
  listContent: { paddingTop: appSpacing.sm, paddingBottom: appSpacing.xxl },
  emptyListContent: { flexGrow: 1, justifyContent: "center" },
  listBanner: { marginBottom: appSpacing.md },
  emptyState: { alignItems: "center", paddingVertical: appSpacing.xxl },
  emptyIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.primarySoft },
  errorIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: appRadii.round, backgroundColor: appColors.dangerSoft },
  stateTitle: { marginTop: appSpacing.md, color: appColors.textPrimary, ...appTypography.sectionTitle, textAlign: "center" },
  stateDescription: { maxWidth: 420, marginTop: appSpacing.sm, color: appColors.textBody, ...appTypography.supporting, textAlign: "center" },
  primaryButton: { minHeight: 44, marginTop: appSpacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: appSpacing.sm, paddingHorizontal: appSpacing.lg, borderRadius: appRadii.control, backgroundColor: appColors.primary },
  primaryButtonText: { color: appColors.surface, ...appTypography.supporting, fontWeight: "700" },
  skeletonList: { paddingTop: appSpacing.sm },
  skeletonRow: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: appSpacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.divider, backgroundColor: appColors.surface },
  skeletonIcon: { width: 40, height: 40, borderRadius: appRadii.round },
  skeletonCopy: { flex: 1, marginLeft: appSpacing.md },
  skeletonTitle: { width: "72%", height: 14, borderRadius: appRadii.small },
  skeletonMeta: { width: "46%", height: 11, marginTop: appSpacing.sm, borderRadius: appRadii.small },
  pressed: { opacity: 0.7 },
});
