import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { AppHeader } from "@/src/components/navigation/AppHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { PROFILE_WIREFRAME } from "@/src/features/profile/wireframe/profile.fixture";
import { useSession } from "@/src/providers/SessionProvider";
import { colors, spacing } from "@/src/theme";

const data = PROFILE_WIREFRAME;

// Profile tab wireframe (demo: account hub). Composition and navigation only —
// customer copy and the grouped entry list are static placeholders from
// profile.fixture.ts. Navigation targets live here (not in the fixture);
// unbuilt entries raise an Alert placeholder. Sign out is the only real action:
// it clears the in-memory dev session via useSession().
export function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useSession();

  // Each entry's target is resolved by its fixture id — real routes stay in the
  // screen, unbuilt destinations fall back to a preview-only Alert.
  const handleEntryPress = (id: string) => {
    switch (id) {
      case "consent":
        Alert.alert("Consent & permissions", "Not available in this preview.");
        return;
      case "security":
        Alert.alert("Security", "Not available in this preview.");
        return;
      case "preferences":
        Alert.alert("Preferences", "Not available in this preview.");
        return;
      case "reports":
        router.push("/(app)/reports");
        return;
      case "settings":
        router.push("/(app)/settings");
        return;
      case "support":
        router.push("/(public)/support");
        return;
      case "legal":
        router.push("/(public)/disclosures");
        return;
      default:
        Alert.alert("Profile", "Not available in this preview.");
    }
  };

  return (
    <Screen scroll>
      <AppHeader initials={data.customer.initials} />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          {/* Customer summary */}
          <Card>
            <Row gap="md" align="center">
              <Avatar
                initials={data.customer.initials}
                size="lg"
                accessibilityLabel={`${data.customer.name}, ${data.customer.tier}`}
              />
              <Stack gap="xxs" style={styles.flex}>
                <Text variant="cardTitle">{data.customer.name}</Text>
                <Text variant="supporting" color={colors.textSecondary}>
                  {data.customer.maskedId}
                </Text>
                <Badge label={data.customer.tier} tone="primary" />
                <Text variant="caption" color={colors.textSecondary}>
                  {data.customer.memberSince}
                </Text>
              </Stack>
            </Row>
          </Card>

          {/* Grouped navigation entries */}
          {data.sections.map((section) => (
            <Section key={section.id} title={section.title}>
              <Stack gap="sm">
                {section.items.map((item) => (
                  <Card
                    key={item.id}
                    onPress={() => handleEntryPress(item.id)}
                    accessibilityLabel={`${item.label}. ${item.detail}.`}
                  >
                    <Row gap="md" align="center">
                      <Icon name={item.icon} size={22} color={colors.brandPrimary} />
                      <Stack gap="xxs" style={styles.flex}>
                        <Text variant="body">{item.label}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {item.detail}
                        </Text>
                      </Stack>
                      {/* chevron-forward affordance: the demo icon set only ships
                          a back chevron, mirrored here to point into the entry. */}
                      <View style={styles.chevron}>
                        <Icon name="back" size={18} color={colors.textSecondary} />
                      </View>
                    </Row>
                  </Card>
                ))}
              </Stack>
            </Section>
          ))}

          {/* Sign out — the only real action; clears the in-memory dev session */}
          <Button label="Sign out" variant="destructive" onPress={signOut} />
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  chevron: {
    transform: [{ scaleX: -1 }],
  },
});
