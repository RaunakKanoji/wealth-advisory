import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import {
  deleteCoachConversation,
  listCoachConversations,
  renameCoachConversation,
} from "@/services/wealth-coach-conversation-service";
import type { CoachConversation } from "@/types/wealth-coach-conversation";

import { coachColors } from "./tokens";

export function CoachHistoryScreen() {
  const router = useRouter();
  const { user } = useUser();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [renameId, setRenameId] = useState<string>();
  const [renameText, setRenameText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConversations(await listCoachConversations(customerId));
      setError(undefined);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "We could not load your conversations.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = (conversation: CoachConversation) => {
    Alert.alert("Delete conversation?", "This removes it from this demo customer's history. It does not claim deletion from any external system.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteCoachConversation(conversation.id, customerId).then(load) },
    ]);
  };

  const saveRename = async () => {
    if (!renameId || !renameText.trim()) return;
    try {
      const updated = await renameCoachConversation(renameId, renameText, customerId);
      setConversations((items) => items.map((item) => item.id === updated.id ? updated : item));
      setRenameId(undefined);
    } catch (renameError: unknown) {
      setError(renameError instanceof Error ? renameError.message : "We could not rename this conversation.");
    }
  };

  return (
    <ScreenContainer backgroundColor={coachColors.background} edges={["top", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Wealth Coach" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={coachColors.textPrimary} /><Text style={styles.backText}>Back to Coach</Text></Pressable>
          <View style={styles.titleRow}><View><Text style={styles.title}>Conversation history</Text><Text style={styles.subtitle}>Stored for this customer in the demo environment.</Text></View><Pressable accessibilityRole="button" onPress={() => router.push("/(app)/coach/new")} style={styles.newButton}><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.newButtonText}>New</Text></Pressable></View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={coachColors.brandGreen} /></View> : <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>{conversations.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={25} color={coachColors.brandGreen} /></View><Text style={styles.emptyTitle}>No conversations yet</Text><Text style={styles.emptyText}>Start a question about spending, saving, or a goal.</Text><Pressable onPress={() => router.push("/(app)/coach/new")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Start a conversation</Text></Pressable></View> : conversations.map((conversation) => <View key={conversation.id} style={styles.row}><Pressable onPress={() => router.push({ pathname: "/(app)/coach/chat", params: { conversationId: conversation.id } })} style={styles.rowMain}><View style={styles.rowIcon}><Ionicons name="chatbubble-outline" size={18} color={coachColors.brandGreen} /></View><View style={styles.rowText}><Text numberOfLines={1} style={styles.rowTitle}>{conversation.title}</Text><Text style={styles.rowMeta}>{conversation.messages.length} message{conversation.messages.length === 1 ? "" : "s"} · {new Date(conversation.updatedAt).toLocaleDateString("en-IN")}</Text></View><Ionicons name="chevron-forward" size={18} color={coachColors.textMuted} /></Pressable><View style={styles.rowActions}><Pressable accessibilityRole="button" accessibilityLabel={`Rename ${conversation.title}`} onPress={() => { setRenameId(conversation.id); setRenameText(conversation.title); }} style={styles.action}><Ionicons name="pencil-outline" size={17} color={coachColors.brandGreen} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${conversation.title}`} onPress={() => remove(conversation)} style={styles.action}><Ionicons name="trash-outline" size={17} color="#B93A2B" /></Pressable></View></View>)}</ScrollView>}
      </View>

      <Modal visible={Boolean(renameId)} transparent animationType="fade" onRequestClose={() => setRenameId(undefined)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Rename conversation</Text><TextInput autoFocus value={renameText} onChangeText={setRenameText} maxLength={60} style={styles.renameInput} placeholder="Conversation name" placeholderTextColor={coachColors.textMuted} /><View style={styles.modalActions}><Pressable onPress={() => setRenameId(undefined)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => void saveRename()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save</Text></Pressable></View></View></View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: coachColors.divider },
  back: { minHeight: 36, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { color: coachColors.textPrimary, fontSize: 15, fontWeight: "600" },
  titleRow: { marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: coachColors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  subtitle: { maxWidth: 290, marginTop: 4, color: coachColors.textSecondary, fontSize: 12, lineHeight: 18 },
  newButton: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderRadius: 11, backgroundColor: coachColors.brandGreen },
  newButtonText: { marginLeft: 4, color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  list: { paddingVertical: 15, paddingBottom: 40 },
  row: { minHeight: 72, marginBottom: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", borderRadius: 15, backgroundColor: coachColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: coachColors.border },
  rowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  rowIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: coachColors.brandGreenSoft },
  rowText: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 6 },
  rowTitle: { color: coachColors.textPrimary, fontSize: 14, fontWeight: "700" },
  rowMeta: { marginTop: 3, color: coachColors.textMuted, fontSize: 11 },
  rowActions: { flexDirection: "row", marginLeft: 2 },
  action: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  error: { marginTop: 12, color: "#B93A2B", fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 70 },
  emptyIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: coachColors.brandGreenSoft },
  emptyTitle: { marginTop: 15, color: coachColors.textPrimary, fontSize: 19, fontWeight: "700" },
  emptyText: { marginTop: 6, color: coachColors.textSecondary, fontSize: 13, textAlign: "center" },
  primaryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: coachColors.brandGreen },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(17,24,39,0.42)" },
  modalCard: { width: "100%", maxWidth: 420, padding: 20, borderRadius: 20, backgroundColor: coachColors.surface },
  modalTitle: { color: coachColors.textPrimary, fontSize: 19, fontWeight: "700" },
  renameInput: { minHeight: 45, marginTop: 15, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: coachColors.border, color: coachColors.textPrimary, fontSize: 14 },
  modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", columnGap: 8 },
  cancelButton: { minHeight: 42, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  cancelText: { color: coachColors.brandGreen, fontSize: 13, fontWeight: "700" },
});
