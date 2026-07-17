import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { PageContainer, Screen, Section, Stack } from "@/src/components/layout";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  Skeleton,
  UnavailableState,
} from "@/src/components/feedback";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Heading,
  ProgressBar,
  RadioGroup,
  Text,
  TextField,
} from "@/src/components/ui";
import { colors, radius } from "@/src/theme";
import type { TypographyRole } from "@/src/theme";

// DEV-ONLY: an internal review surface for the whole foundation — shells,
// navigation, design tokens, shared UI, and feedback states. NOT linked from
// customer navigation. Remove or disable this single file before shipping to
// production.

type ShellLink = { label: string; href: Href; note?: string };

const SHELL_GROUPS: { title: string; description: string; links: ShellLink[] }[] = [
  {
    title: "Public shell",
    description: "Bank identity, page container, support action. No session required.",
    links: [
      { label: "Welcome", href: "/(auth)" },
      { label: "Disclosures", href: "/(public)/disclosures" },
      { label: "Support", href: "/(public)/support" },
    ],
  },
  {
    title: "Authentication shell",
    description: "Secure-access heading, keyboard-safe content, support action. Wireframes only.",
    links: [
      { label: "Sign in", href: "/(auth)/sign-in" },
      { label: "Create account", href: "/(auth)/sign-up" },
    ],
  },
  {
    title: "Onboarding shell",
    description:
      "Progress, step title, back, sticky action. Available only to an authenticated Clerk session.",
    links: [
      { label: "Consent introduction", href: "/(onboarding)/consent/introduction", note: "guarded" },
      { label: "Financial profile", href: "/(onboarding)/financial-profile", note: "guarded" },
      { label: "Risk profile", href: "/(onboarding)/risk-profile", note: "guarded" },
      { label: "Completion", href: "/(onboarding)/completion", note: "guarded" },
    ],
  },
  {
    title: "Authenticated shell",
    description:
      "Header, primary navigation, notification + avatar actions. Available only to an authenticated Clerk session.",
    links: [{ label: "Home dashboard & tabs", href: "/(app)/(tabs)", note: "guarded" }],
  },
];

const TYPOGRAPHY_SAMPLES: TypographyRole[] = [
  "display",
  "pageTitle",
  "sectionTitle",
  "cardTitle",
  "body",
  "supporting",
  "caption",
  "buttonLabel",
  "financialValue",
  "financialValueLabel",
];

const COLOR_SWATCHES: { name: string; value: string }[] = [
  { name: "brandPrimary", value: colors.brandPrimary },
  { name: "brandSecondary", value: colors.brandSecondary },
  { name: "brandSecondaryStrong", value: colors.brandSecondaryStrong },
  { name: "background", value: colors.background },
  { name: "surface", value: colors.surface },
  { name: "textPrimary", value: colors.textPrimary },
  { name: "textSecondary", value: colors.textSecondary },
  { name: "textMuted", value: colors.textMuted },
  { name: "border", value: colors.border },
  { name: "success", value: colors.success },
  { name: "warning", value: colors.warning },
  { name: "error", value: colors.error },
  { name: "info", value: colors.info },
];

export default function FoundationPreview() {
  const router = useRouter();
  const [textValue, setTextValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [radioValue, setRadioValue] = useState<string | null>("balanced");
  const [showLoading, setShowLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.page}>
          <Stack gap="xs">
            <Heading level="display">Foundation preview</Heading>
            <Text variant="supporting" color={colors.textSecondary}>
              Internal review surface — not part of customer navigation. Remove before production.
            </Text>
          </Stack>

          <Section
            title="Shells"
            description="Each application shell and its primary destinations."
          >
            <Stack gap="md">
              {SHELL_GROUPS.map((group) => (
                <Card key={group.title}>
                  <Stack gap="sm">
                    <Text variant="cardTitle">{group.title}</Text>
                    <Text variant="supporting" color={colors.textSecondary}>
                      {group.description}
                    </Text>
                    <View style={styles.row}>
                      {group.links.map((link) => (
                        <Button
                          key={link.label}
                          label={link.note ? `${link.label} ↗` : link.label}
                          variant="secondary"
                          onPress={() => router.push(link.href)}
                        />
                      ))}
                    </View>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Section>

          <Section
            title="Navigation"
            description="One route config powers both layouts (src/components/navigation)."
          >
            <Card>
              <Stack gap="sm">
                <Text variant="body" color={colors.textSecondary}>
                  Compact width shows the bottom tab bar. Medium and expanded widths hide it and show
                  the navigation rail beside the same navigator — never both at once. On web, resize
                  the window across ~768px and ~1024px to switch between them.
                </Text>
              </Stack>
            </Card>
          </Section>

          <Divider />

          <Section title="Typography">
            <Stack gap="sm">
              {TYPOGRAPHY_SAMPLES.map((role) => (
                <Text key={role} variant={role}>
                  {role} — The quick brown fox
                </Text>
              ))}
            </Stack>
          </Section>

          <Divider />

          <Section title="Colors">
            <View style={styles.swatchGrid}>
              {COLOR_SWATCHES.map((swatch) => (
                <View key={swatch.name} style={styles.swatchItem}>
                  <View style={[styles.swatch, { backgroundColor: swatch.value }]} />
                  <Text variant="caption">{swatch.name}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Divider />

          <Section title="Buttons">
            <Stack gap="sm">
              <Button label="Primary" variant="primary" onPress={() => {}} />
              <Button label="Accent" variant="accent" onPress={() => {}} />
              <Button label="Secondary" variant="secondary" onPress={() => {}} />
              <Button label="Ghost" variant="ghost" onPress={() => {}} />
              <Button label="Destructive" variant="destructive" onPress={() => {}} />
              <Button label="Disabled" variant="primary" disabled onPress={() => {}} />
              <Button label="Loading" variant="primary" loading onPress={() => {}} />
            </Stack>
          </Section>

          <Divider />

          <Section title="Inputs">
            <Stack gap="md">
              <TextField
                label="Text field"
                placeholder="Type something"
                value={textValue}
                onChangeText={setTextValue}
              />
              <TextField label="With error" error="This field is required" />
              <Checkbox checked={checked} onChange={setChecked} label="I agree to the terms" />
              <RadioGroup
                value={radioValue}
                onChange={setRadioValue}
                options={[
                  { value: "conservative", label: "Conservative" },
                  { value: "balanced", label: "Balanced", description: "Default risk profile" },
                  { value: "growth", label: "Growth" },
                ]}
              />
            </Stack>
          </Section>

          <Divider />

          <Section title="Cards">
            <Stack gap="sm">
              <Card>
                <Text variant="cardTitle">Static card</Text>
                <Text variant="supporting" color={colors.textSecondary}>
                  Not pressable.
                </Text>
              </Card>
              <Card onPress={() => {}} accessibilityLabel="Pressable card example">
                <Text variant="cardTitle">Pressable card</Text>
                <Text variant="supporting" color={colors.textSecondary}>
                  Tap me.
                </Text>
              </Card>
            </Stack>
          </Section>

          <Divider />

          <Section title="Badges & Chips">
            <Stack gap="sm">
              <View style={styles.row}>
                <Badge label="Primary" tone="primary" />
                <Badge label="Success" tone="success" />
                <Badge label="Warning" tone="warning" />
                <Badge label="Error" tone="error" />
                <Badge label="Info" tone="info" />
              </View>
              <View style={styles.row}>
                <Chip label="All" selected onPress={() => {}} />
                <Chip label="Equities" onPress={() => {}} />
                <Chip label="Bonds" onPress={() => {}} />
              </View>
            </Stack>
          </Section>

          <Divider />

          <Section title="Progress">
            <Stack gap="sm">
              <ProgressBar value={30} accessibilityLabel="30 percent complete" />
              <ProgressBar value={70} accessibilityLabel="70 percent complete" />
              <ProgressBar
                value={50}
                tint={colors.brandSecondaryStrong}
                accessibilityLabel="50 percent complete, accent tint"
              />
              <Skeleton height={20} />
              <Skeleton width="60%" height={20} />
            </Stack>
          </Section>

          <Divider />

          <Section title="Feedback states">
            <Stack gap="sm">
              <View style={styles.row}>
                <Button label="Toggle loading" variant="secondary" onPress={() => setShowLoading((v) => !v)} />
                <Button label="Toggle error" variant="secondary" onPress={() => setShowError((v) => !v)} />
                <Button label="Toggle empty" variant="secondary" onPress={() => setShowEmpty((v) => !v)} />
                <Button
                  label="Toggle unavailable"
                  variant="secondary"
                  onPress={() => setShowUnavailable((v) => !v)}
                />
                <Button label="Toggle offline" variant="secondary" onPress={() => setShowOffline((v) => !v)} />
              </View>
              {showLoading ? (
                <View style={styles.stateBox}>
                  <LoadingState label="Loading" />
                </View>
              ) : null}
              {showError ? (
                <View style={styles.stateBox}>
                  <ErrorState onRetry={() => setShowError(false)} />
                </View>
              ) : null}
              {showEmpty ? (
                <View style={styles.stateBox}>
                  <EmptyState
                    message="No goals yet"
                    actionLabel="Add a goal"
                    onAction={() => setShowEmpty(false)}
                  />
                </View>
              ) : null}
              {showUnavailable ? (
                <View style={styles.stateBox}>
                  <UnavailableState onRetry={() => setShowUnavailable(false)} />
                </View>
              ) : null}
              {showOffline ? <OfflineState /> : null}
            </Stack>
          </Section>
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 32,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatchItem: {
    alignItems: "center",
    gap: 4,
    width: 80,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  stateBox: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
});
