import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useBalanceVisibility } from "@/components/accounts/use-balance-visibility";
import { ScreenContainer } from "@/components/screen-container";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { isRemoteCoachEnabled } from "@/lib/env";
import { privacySafeFinancialText } from "@/lib/privacy";
import {
  deleteCoachConversation,
  listCoachConversations,
  renameCoachConversation,
} from "@/services/wealth-coach-conversation-service";
import type { CoachConversation } from "@/types/wealth-coach-conversation";

import { conversationDateLabel, conversationGroupLabel } from "./conversation-row";
import { RemoteCoachHistoryScreen } from "./remote-coach-history-screen";
import { coachColors } from "./tokens";

type LocalHistoryListItem =
  | { type: "group"; key: string; label: string }
  | { type: "conversation"; key: string; conversation: CoachConversation; isFirst: boolean; isLast: boolean };

export function CoachHistoryScreen() {
  if (isRemoteCoachEnabled) {
    return <RemoteCoachHistoryScreen />;
  }

  return <LocalCoachHistoryScreen />;
}

function LocalCoachHistoryScreen() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const { balanceVisible } = useBalanceVisibility(customerId, isUserLoaded);
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<string>();
  const [renameText, setRenameText] = useState("");
  const [stateCustomerId, setStateCustomerId] = useState(customerId);
  const activeCustomerId = useRef(customerId);
  const loadRequestId = useRef(0);
  activeCustomerId.current = customerId;
  const isCurrentCustomer = stateCustomerId === customerId;
  const visibleConversations = useMemo(
    () => isCurrentCustomer ? conversations : [],
    [conversations, isCurrentCustomer],
  );
  const visibleError = isCurrentCustomer ? error : undefined;
  const visibleLoading = !isCurrentCustomer || loading;

  const load = useCallback(async () => {
    if (activeCustomerId.current !== customerId) return;
    const requestedCustomerId = customerId;
    const requestId = ++loadRequestId.current;
    setLoading(true);
    try {
      const nextConversations = await listCoachConversations(requestedCustomerId);
      if (activeCustomerId.current !== requestedCustomerId || loadRequestId.current !== requestId) return;
      setConversations(nextConversations);
      setStateCustomerId(requestedCustomerId);
      setError(undefined);
    } catch (loadError: unknown) {
      if (activeCustomerId.current !== requestedCustomerId || loadRequestId.current !== requestId) return;
      setConversations([]);
      setStateCustomerId(requestedCustomerId);
      setError(loadError instanceof Error ? loadError.message : "We could not load your conversations.");
    } finally {
      if (activeCustomerId.current === requestedCustomerId && loadRequestId.current === requestId) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!balanceVisible) setRenameId(undefined);
  }, [balanceVisible]);

  useEffect(() => {
    if (isCurrentCustomer) return;
    setRenameId(undefined);
    setRenameText("");
    setQuery("");
  }, [isCurrentCustomer]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return visibleConversations
      .filter((conversation) => {
        if (!normalizedQuery) return true;
        const displayTitle = visibleConversationTitle(conversation.title, balanceVisible);
        const searchableValues = balanceVisible
          ? [displayTitle, ...conversation.messages.map((message) => message.content)]
          : [displayTitle];
        return searchableValues
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [balanceVisible, query, visibleConversations]);

  const groupedConversations = useMemo(() => {
    const groups = new Map<string, CoachConversation[]>();
    filteredConversations.forEach((conversation) => {
      const label = conversationGroupLabel(conversation.updatedAt);
      groups.set(label, [...(groups.get(label) ?? []), conversation]);
    });
    return [...groups.entries()];
  }, [filteredConversations]);

  const historyItems = useMemo<LocalHistoryListItem[]>(() => groupedConversations.flatMap(([label, group]) => [
    { type: "group" as const, key: `group:${label}`, label },
    ...group.map((conversation, index) => ({
      type: "conversation" as const,
      key: `conversation:${conversation.id}`,
      conversation,
      isFirst: index === 0,
      isLast: index === group.length - 1,
    })),
  ]), [groupedConversations]);

  const selectedRenameConversation = visibleConversations.find((conversation) => conversation.id === renameId);
  const canShowRename = Boolean(
    selectedRenameConversation
    && (
      balanceVisible
      || visibleConversationTitle(selectedRenameConversation.title, false) === selectedRenameConversation.title
    )
  );

  const remove = (conversation: CoachConversation) => {
    const requestedCustomerId = customerId;
    Alert.alert("Delete conversation?", "This removes it from this demo customer's history. It does not claim deletion from any external system.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (activeCustomerId.current !== requestedCustomerId) return;
          void deleteCoachConversation(conversation.id, requestedCustomerId).then(() => {
            if (activeCustomerId.current === requestedCustomerId) void load();
          }).catch((deleteError: unknown) => {
            if (activeCustomerId.current === requestedCustomerId) {
              setError(deleteError instanceof Error ? deleteError.message : "We could not delete this conversation.");
            }
          });
        },
      },
    ]);
  };

  const saveRename = async () => {
    if (!renameId || !renameText.trim()) return;
    const requestedCustomerId = customerId;
    const selectedConversation = visibleConversations.find((conversation) => conversation.id === renameId);
    if (
      selectedConversation
      && !balanceVisible
      && visibleConversationTitle(selectedConversation.title, false) !== selectedConversation.title
    ) {
      setRenameId(undefined);
      return;
    }
    try {
      const updated = await renameCoachConversation(renameId, renameText, requestedCustomerId);
      if (activeCustomerId.current !== requestedCustomerId) return;
      setConversations((items) => items.map((item) => item.id === updated.id ? updated : item));
      setRenameId(undefined);
    } catch (renameError: unknown) {
      if (activeCustomerId.current !== requestedCustomerId) return;
      setError(renameError instanceof Error ? renameError.message : "We could not rename this conversation.");
    }
  };

  return (
    <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Wealth Coach" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={coachColors.textPrimary} /><Text style={styles.backText}>Back to Coach</Text></Pressable>
          <View style={styles.titleRow}><View><Text style={styles.title}>Coach history</Text><Text style={styles.subtitle}>Stored for this customer in the demo environment.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Start a new Coach conversation" onPress={() => router.push("/(app)/coach/new")} style={styles.newButton}><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.newButtonText}>New chat</Text></Pressable></View>
        </View>
        {visibleError ? <Text style={styles.error} accessibilityRole="alert">{visibleError}</Text> : null}
        {visibleLoading ? <View style={styles.loading}><ActivityIndicator color={coachColors.brandGreen} /></View> : (
          <FlatList
            data={historyItems}
            keyExtractor={(item) => item.key}
            contentContainerStyle={[styles.list, historyItems.length === 0 && styles.emptyList]}
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={7}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color={coachColors.textMuted} />
              <TextInput
                accessibilityLabel="Search conversations"
                value={query}
                onChangeText={setQuery}
                placeholder="Search conversations"
                placeholderTextColor={coachColors.textMuted}
                style={styles.searchInput}
              />
              {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear conversation search" onPress={() => setQuery("")} style={styles.clearSearch}><Ionicons name="close-circle" size={18} color={coachColors.textMuted} /></Pressable> : null}
            </View>}
            ListEmptyComponent={<View style={styles.empty}>
                <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={25} color={coachColors.brandGreen} /></View>
                <Text style={styles.emptyTitle}>{query ? "No matching conversations" : "No conversations yet"}</Text>
                <Text style={styles.emptyText}>{query ? "Try a different search." : "Ask your Wealth Coach a question to get started."}</Text>
                {!query ? <Pressable accessibilityRole="button" accessibilityLabel="Start a new Coach conversation" onPress={() => router.push("/(app)/coach/new")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Start a conversation</Text></Pressable> : null}
              </View>}
            renderItem={({ item }) => {
              if (item.type === "group") return <Text accessibilityRole="header" style={styles.groupTitle}>{item.label}</Text>;
              const { conversation, isFirst, isLast } = item;
              const displayTitle = visibleConversationTitle(conversation.title, balanceVisible);
              const canRename = balanceVisible || displayTitle === conversation.title;

              return (
                      <View style={[styles.rowWrapper, isFirst && styles.rowWrapperFirst, isLast && styles.rowWrapperLast]}>
                        <View style={styles.row}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Resume ${displayTitle}`} onPress={() => router.push({ pathname: "/(app)/coach/chat", params: { conversationId: conversation.id } })} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
                            <View style={styles.rowIcon}><Ionicons name="chatbubble-outline" size={19} color={coachColors.brandGreen} /></View>
                            <View style={styles.rowText}><Text numberOfLines={1} ellipsizeMode="tail" style={styles.rowTitle}>{displayTitle}</Text><Text style={styles.rowMeta}>{conversationDateLabel(conversation.updatedAt)} · {conversation.messages.length} message{conversation.messages.length === 1 ? "" : "s"}</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={coachColors.textMuted} />
                          </Pressable>
                          <View style={styles.rowActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={canRename ? `Rename ${displayTitle}` : "Rename unavailable while balances are hidden"}
                              accessibilityState={{ disabled: !canRename }}
                              disabled={!canRename}
                              onPress={() => {
                                if (!canRename) return;
                                setRenameId(conversation.id);
                                setRenameText(conversation.title);
                              }}
                              style={[styles.action, !canRename && styles.disabledAction]}
                            >
                              <Ionicons name="pencil-outline" size={17} color={coachColors.brandGreen} />
                            </Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${displayTitle}`} onPress={() => remove(conversation)} style={styles.action}><Ionicons name="trash-outline" size={17} color="#B93A2B" /></Pressable>
                          </View>
                        </View>
                        {!isLast ? <View style={styles.divider} /> : null}
                      </View>
              );
            }}
          />
        )}
      </View>

      <Modal visible={canShowRename} transparent animationType="fade" onRequestClose={() => setRenameId(undefined)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Rename conversation</Text><TextInput accessibilityLabel="Conversation name" autoFocus value={canShowRename ? renameText : ""} onChangeText={setRenameText} maxLength={60} style={styles.renameInput} placeholder="Conversation name" placeholderTextColor={coachColors.textMuted} /><View style={styles.modalActions}><Pressable accessibilityRole="button" accessibilityLabel="Cancel renaming conversation" onPress={() => setRenameId(undefined)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Save conversation name" accessibilityState={{ disabled: !renameText.trim() }} disabled={!renameText.trim()} onPress={() => void saveRename()} style={[styles.primaryButton, !renameText.trim() && styles.disabledButton]}><Text style={styles.primaryButtonText}>Save</Text></Pressable></View></View></View>
      </Modal>
    </ScreenContainer>
  );
}

function visibleConversationTitle(title: string, balanceVisible: boolean): string {
  return balanceVisible
    ? title
    : privacySafeFinancialText(title, "Financial question");
}

const styles = StyleSheet.create({
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { color: coachColors.textPrimary, fontSize: 15, fontWeight: "600" },
  titleRow: { marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: coachColors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  subtitle: { maxWidth: 290, marginTop: 4, color: coachColors.textSecondary, fontSize: 12, lineHeight: 18 },
  newButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderRadius: 11, backgroundColor: coachColors.brandGreen },
  newButtonText: { marginLeft: 4, color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  list: { paddingTop: 15, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, borderRadius: 14, backgroundColor: coachColors.surface, borderWidth: 1, borderColor: coachColors.border },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 9, paddingVertical: 11, color: coachColors.textPrimary, fontSize: 14 },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  groupTitle: { marginTop: 22, marginBottom: 9, color: coachColors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  rowWrapper: { overflow: "hidden", backgroundColor: coachColors.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  rowWrapperFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 17, borderTopRightRadius: 17 },
  rowWrapperLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 17, borderBottomRightRadius: 17 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11 },
  rowMain: { flex: 1, minWidth: 0, minHeight: 52, flexDirection: "row", alignItems: "center", paddingLeft: 4 },
  rowIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: coachColors.brandGreenSoft },
  rowText: { flex: 1, minWidth: 0, marginLeft: 11, marginRight: 6 },
  rowTitle: { color: coachColors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  rowMeta: { marginTop: 2, color: coachColors.textSecondary, fontSize: 13, lineHeight: 18 },
  rowActions: { flexDirection: "row", marginLeft: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70, backgroundColor: coachColors.divider },
  pressed: { opacity: 0.7 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  disabledAction: { opacity: 0.4 },
  error: { marginTop: 12, color: "#B93A2B", fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 70 },
  emptyIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: coachColors.brandGreenSoft },
  emptyTitle: { marginTop: 15, color: coachColors.textPrimary, fontSize: 19, fontWeight: "700" },
  emptyText: { marginTop: 6, color: coachColors.textSecondary, fontSize: 13, textAlign: "center" },
  primaryButton: { minHeight: 44, marginTop: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: coachColors.brandGreen },
  disabledButton: { opacity: 0.45 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(17,24,39,0.42)" },
  modalCard: { width: "100%", maxWidth: 420, padding: 20, borderRadius: 20, backgroundColor: coachColors.surface },
  modalTitle: { color: coachColors.textPrimary, fontSize: 19, fontWeight: "700" },
  renameInput: { minHeight: 45, marginTop: 15, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: coachColors.border, color: coachColors.textPrimary, fontSize: 14 },
  modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", columnGap: 8 },
  cancelButton: { minHeight: 44, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  cancelText: { color: coachColors.brandGreen, fontSize: 13, fontWeight: "700" },
});
