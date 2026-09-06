import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getServiceDefinition } from "@/data/services-registry";

const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#111827",
  secondary: "#6F7888",
  green: "#007E5D",
  greenSoft: "#E9F5F2",
  border: "#E8EBEF",
  orange: "#C43E12",
};

export function ServiceInformationScreen() {
  const router = useRouter();
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string | string[] }>();
  const serviceId = Array.isArray(rawServiceId) ? rawServiceId[0] : rawServiceId;
  const service = serviceId ? getServiceDefinition(serviceId) : undefined;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/services");
  };

  if (!service || service.destination.kind !== "information") {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={23} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.card}>
            <Text style={styles.title}>Service unavailable</Text>
            <Text style={styles.description}>This service link is no longer available in the current catalogue.</Text>
          </View>
        </View>
      </View>
    );
  }

  const information = service.destination.information;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={23} color={colors.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.environmentBadge}>Information</Text>
          </View>
          <View style={styles.iconCircle}>
            <Ionicons name="information-circle-outline" size={30} color={colors.green} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{service.title}</Text>
          <Text style={styles.description}>{service.description}</Text>

          <InfoSection title="What this service is" body={information.whatItIs} />
          <InfoSection title="Available in this app" body={information.availableHere} />
          {information.notConnected ? <InfoSection title="What is not connected" body={information.notConnected} warning /> : null}
          <InfoSection title="Next step" body={information.nextStep} />

          {information.relatedServiceId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Find ${getServiceDefinition(information.relatedServiceId)?.title ?? "related service"}`}
              onPress={() => router.push({ pathname: "/(app)/services", params: { focusServiceId: information.relatedServiceId } } as never)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Find related service</Text>
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoSection({ title, body, warning = false }: { title: string; body: string; warning?: boolean }) {
  return (
    <View style={[styles.infoSection, warning && styles.warningSection]}>
      <Text style={[styles.infoTitle, warning && styles.warningTitle]}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 34 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 20 },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { marginLeft: 2, color: colors.text, fontSize: 16, fontWeight: "600" },
  environmentBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.greenSoft, color: colors.green, fontSize: 12, fontWeight: "700" },
  iconCircle: { width: 64, height: 64, marginTop: 24, alignItems: "center", justifyContent: "center", borderRadius: 32, backgroundColor: colors.greenSoft },
  title: { marginTop: 18, color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: "700" },
  description: { marginTop: 8, color: colors.secondary, fontSize: 16, lineHeight: 24 },
  card: { marginTop: 28, padding: 24, borderRadius: 22, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  infoSection: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  warningSection: { borderColor: "#F2D4C7", backgroundColor: "#FFF8F4" },
  infoTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  warningTitle: { color: colors.orange },
  infoBody: { marginTop: 6, color: colors.secondary, fontSize: 15, lineHeight: 23 },
  primaryButton: { minHeight: 52, marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, backgroundColor: colors.green },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
