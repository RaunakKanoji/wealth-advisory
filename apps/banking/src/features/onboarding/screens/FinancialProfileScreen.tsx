import { useRouter } from "expo-router";

import { Row } from "@/src/components/layout/Row";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Card } from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { TextField } from "@/src/components/ui/TextField";
import { StepScaffold } from "@/src/features/onboarding/components/StepScaffold";
import { ONBOARDING_WIREFRAME } from "@/src/features/onboarding/wireframe/onboarding.fixture";
import { colors } from "@/src/theme";

const data = ONBOARDING_WIREFRAME.financialProfile;

// Onboarding step 1 of 3 — read-only review of the financial profile. Every
// figure is static placeholder content from onboarding.fixture.ts; nothing is
// fetched or calculated here. Composition + navigation only.
export function FinancialProfileScreen() {
  const router = useRouter();

  return (
    <StepScaffold
      step={data.step}
      totalSteps={ONBOARDING_WIREFRAME.totalSteps}
      title={data.title}
      description={data.description}
      onBack={() => router.back()}
      primaryLabel="Continue"
      onPrimary={() => router.push("/(onboarding)/risk-profile")}
    >
      <Stack gap="xl">
        {data.summarySections.map((section) => (
          <Section key={section.title} title={section.title}>
            <Card>
              <Stack gap="sm">
                {section.rows.map((row) => (
                  <Row key={row.label} justify="space-between">
                    <Text variant="supporting" color={colors.textSecondary}>
                      {row.label}
                    </Text>
                    <Text variant="body">{row.value}</Text>
                  </Row>
                ))}
              </Stack>
            </Card>
          </Section>
        ))}

        {/* Prefilled, non-editable identity fields (read-only wireframe). */}
        <Section title={data.profileDetails.title}>
          <Stack gap="md">
            <Text variant="caption" color={colors.textSecondary}>
              {data.profileDetails.note}
            </Text>
            {data.profileDetails.fields.map((field) => (
              <TextField
                key={field.label}
                label={field.label}
                value={field.value}
                editable={false}
              />
            ))}
          </Stack>
        </Section>
      </Stack>
    </StepScaffold>
  );
}
