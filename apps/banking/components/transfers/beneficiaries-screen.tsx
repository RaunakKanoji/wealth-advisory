import Ionicons from "@expo/vector-icons/Ionicons";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import { archiveBeneficiary, createBeneficiary, getBeneficiaries, updateBeneficiaryNickname } from "@/services/transfer-service";
import type { Beneficiary } from "@/types/transfers";

const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#111827",
  secondary: "#6F7888",
  muted: "#98A1AE",
  green: "#007E5D",
  greenDark: "#006647",
  greenSoft: "#E9F5F2",
  orange: "#F45B2A",
  border: "#E8EBEF",
  danger: "#A62B32",
};

function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

export function BeneficiariesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [items, setItems] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [adding, setAdding] = useState(firstParam(rawMode) === "add");
  const [type, setType] = useState<"bank-account" | "upi">("bank-account");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState<Beneficiary | null>(null);
  const [editingNickname, setEditingNickname] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try { setItems(await getBeneficiaries({ customerId })); setState("ready"); } catch { setState("error"); }
  }, [customerId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter((item) => [item.nickname, item.bankReturnedName, item.maskedAccountNumber, item.upiId, item.bankName].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const input = type === "bank-account"
        ? { type: "bank-account" as const, accountNumber, confirmAccountNumber, ifsc, recipientName, nickname, saveBeneficiary: true }
        : { type: "upi" as const, upiId, recipientName, nickname, saveBeneficiary: true };
      await createBeneficiary(input, { customerId });
      setAdding(false);
      setAccountNumber(""); setConfirmAccountNumber(""); setIfsc(""); setUpiId(""); setRecipientName(""); setNickname("");
      await load();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Beneficiary could not be saved"); } finally { setBusy(false); }
  };

  const editNickname = (item: Beneficiary) => { setEditingItem(item); setEditingNickname(item.nickname ?? ""); };

  const saveNickname = async () => {
    if (!editingItem || busy) return;
    setBusy(true);
    try { await updateBeneficiaryNickname(editingItem.id, editingNickname, { customerId }); setEditingItem(null); await load(); } catch (nextError) { Alert.alert("Nickname not saved", nextError instanceof Error ? nextError.message : "Please try again."); } finally { setBusy(false); }
  };

  const remove = (item: Beneficiary) => Alert.alert("Archive beneficiary?", "This removes it from new transfer selection without changing any existing transfer history.", [{ text: "Keep", style: "cancel" }, { text: "Archive", style: "destructive", onPress: async () => { try { await archiveBeneficiary(item.id, { customerId }); await load(); } catch (nextError) { Alert.alert("Beneficiary not archived", nextError instanceof Error ? nextError.message : "Please try again."); } } }]);

  return <View style={styles.screen}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}><View style={[styles.content, { padding: width < 375 ? 16 : 20, maxWidth: 820 }]}><View style={styles.headerRow}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/transfer")} style={styles.backButton}><Ionicons name="chevron-back" size={23} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setAdding((current) => !current)} style={styles.addButton}><Ionicons name={adding ? "close-outline" : "add-outline"} size={20} color={colors.greenDark} /><Text style={styles.addButtonText}>{adding ? "Cancel" : "Add"}</Text></Pressable></View><Text accessibilityRole="header" style={styles.title}>Beneficiaries</Text><Text style={styles.subtitle}>Manage saved recipients separately from bank registration status.</Text>{adding ? <View style={styles.formCard}><Text style={styles.formTitle}>Add beneficiary</Text><Text style={styles.formDescription}>A saved demo row does not claim that a live bank registration succeeded.</Text><View style={styles.typeRow}><TypeButton label="Bank account" selected={type === "bank-account"} onPress={() => setType("bank-account")} /><TypeButton label="UPI ID" selected={type === "upi"} onPress={() => setType("upi")} /></View>{type === "bank-account" ? <><Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder="6 to 24 digits" /><Field label="Confirm account number" value={confirmAccountNumber} onChangeText={setConfirmAccountNumber} keyboardType="number-pad" placeholder="Re-enter account number" /><Field label="IFSC" value={ifsc} onChangeText={(value) => setIfsc(value.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="IBKL0000123" /></> : <Field label="UPI ID" value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" placeholder="name@bank" />}<Field label="Recipient name" value={recipientName} onChangeText={setRecipientName} placeholder="Name returned or entered for review" /><Field label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder="Your label for this recipient" />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={() => void add()} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Save beneficiary</Text>}</Pressable></View> : null}<View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.secondary} /><TextInput accessibilityLabel="Search beneficiaries" value={search} onChangeText={setSearch} placeholder="Search saved recipients" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>{state === "loading" ? <View style={styles.center}><ActivityIndicator color={colors.green} /></View> : state === "error" ? <EmptyState title="Beneficiaries unavailable" description="The saved recipient request failed. Try again." action="Retry" onPress={() => void load()} /> : filtered.length === 0 ? <EmptyState title={items.length === 0 ? "No saved beneficiaries" : "No matching beneficiaries"} description={items.length === 0 ? "Add a bank account or UPI recipient when you are ready." : "Try another search."} action={items.length === 0 ? "Add beneficiary" : undefined} onPress={items.length === 0 ? () => setAdding(true) : undefined} /> : <View style={styles.listCard}>{filtered.map((item) => <View key={item.id} style={styles.item}><View style={styles.itemIcon}><Ionicons name={item.type === "upi" ? "at-outline" : "business-outline"} size={21} color={colors.greenDark} /></View><View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.nickname ?? item.bankReturnedName ?? item.upiId ?? "Recipient"}</Text>{item.bankReturnedName ? <Text style={styles.itemMeta}>Name returned by bank: {item.bankReturnedName}</Text> : null}<Text style={styles.itemMeta}>{item.maskedAccountNumber ?? item.upiId}{item.bankName ? ` · ${item.bankName}` : ""}</Text><Text style={[styles.itemStatus, item.status === "active" ? styles.active : styles.pending]}>{item.status.replace("-", " ")} · {item.resolutionStatus === "resolved" ? "lookup resolved" : "lookup unavailable"}</Text></View><View style={styles.itemActions}><Pressable accessibilityRole="button" accessibilityLabel={`Use ${item.nickname ?? item.bankReturnedName ?? item.upiId}`} onPress={() => router.push({ pathname: "/(app)/transfers/new", params: { type: item.type === "upi" ? "upi" : "bank-account", beneficiaryId: item.id } })} style={styles.iconButton}><Ionicons name="arrow-forward-outline" size={19} color={colors.greenDark} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Edit beneficiary nickname" onPress={() => editNickname(item)} style={styles.iconButton}><Ionicons name="create-outline" size={19} color={colors.secondary} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Archive beneficiary" onPress={() => remove(item)} style={styles.iconButton}><Ionicons name="archive-outline" size={19} color={colors.orange} /></Pressable></View></View>)}</View>}<View style={styles.disclosure}><Ionicons name="shield-checkmark-outline" size={18} color={colors.greenDark} /><Text style={styles.disclosureText}>Only masked destinations are shown here. A local demo save is not a bank registration confirmation.</Text></View></View></ScrollView><Modal visible={editingItem !== null} transparent animationType="slide" onRequestClose={() => setEditingItem(null)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.formTitle}>Edit nickname</Text><Text style={styles.formDescription}>The bank-returned legal name and destination will not change.</Text><TextInput accessibilityLabel="Beneficiary nickname" value={editingNickname} onChangeText={setEditingNickname} placeholder="Nickname" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.modalActions}><Pressable accessibilityRole="button" onPress={() => setEditingItem(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveNickname()} style={[styles.primaryButton, styles.modalPrimary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save"}</Text></Pressable></View></View></View></Modal></View>;
}

function TypeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.typeButton, selected && styles.typeSelected]}><Text style={[styles.typeText, selected && styles.typeTextSelected]}>{label}</Text></Pressable>; }
function Field({ label, value, onChangeText, placeholder, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string } & Partial<React.ComponentProps<typeof TextInput>>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.input} {...props} /></View>; }
function EmptyState({ title, description, action, onPress }: { title: string; description: string; action?: string; onPress?: () => void }) { return <View style={styles.empty}><Ionicons name="people-outline" size={28} color={colors.greenDark} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{description}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{action}</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { width: "100%", alignItems: "center", paddingTop: 12, paddingBottom: 36 },
  content: { width: "100%", alignSelf: "center" },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 },
  backText: { marginLeft: 3, color: colors.text, fontSize: 16, fontWeight: "600" },
  addButton: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 5 },
  addButtonText: { marginLeft: 4, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  title: { marginTop: 14, color: colors.text, fontSize: 30, fontWeight: "800" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 15, lineHeight: 22 },
  formCard: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  formDescription: { marginTop: 4, color: colors.secondary, fontSize: 13, lineHeight: 19 },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  typeButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 13, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  typeSelected: { backgroundColor: colors.greenSoft, borderColor: "#AED9CE" },
  typeText: { color: colors.secondary, fontSize: 13, fontWeight: "700" },
  typeTextSelected: { color: colors.greenDark },
  field: { marginTop: 13 },
  label: { marginBottom: 6, color: colors.text, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 },
  errorText: { marginTop: 10, padding: 10, borderRadius: 9, color: colors.danger, backgroundColor: "#FDECEC", fontSize: 13 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 16, borderRadius: 13, backgroundColor: colors.green },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", marginTop: 20, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minHeight: 44, marginLeft: 8, color: colors.text, fontSize: 14 },
  listCard: { marginTop: 16, borderRadius: 17, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  item: { minHeight: 100, flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.greenSoft },
  itemCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  itemMeta: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  itemStatus: { marginTop: 4, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  active: { color: colors.greenDark },
  pending: { color: colors.orange },
  itemActions: { alignItems: "center" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: 18, padding: 24, borderRadius: 18, backgroundColor: colors.surface },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { marginTop: 5, color: colors.secondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.greenSoft },
  secondaryText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  center: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  disclosure: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 13, borderRadius: 13, backgroundColor: colors.greenSoft },
  disclosureText: { flex: 1, marginLeft: 8, color: colors.secondary, fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.35)" },
  modalCard: { padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.surface },
  modalActions: { flexDirection: "row", gap: 9, marginTop: 4 },
  modalPrimary: { flex: 1, marginTop: 13 },
});
