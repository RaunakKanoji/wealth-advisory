import { useRouter } from "expo-router";
import { useState } from "react";

import { Stack } from "@/src/components/layout/Stack";
import { Card } from "@/src/components/ui/Card";
import { RadioGroup } from "@/src/components/ui/RadioGroup";
import { Text } from "@/src/components/ui/Text";
import { StepScaffold } from "@/src/features/onboarding/components/StepScaffold";
import { ONBOARDING_WIREFRAME } from "@/src/features/onboarding/wireframe/onboarding.fixture";
import { colors } from "@/src/theme";

const data = ONBOARDING_WIREFRAME.riskProfile;

// Onboarding step 2 of 3 — a sample risk-assessment question. The radio
// selection is trivial local UI state only; there is NO scoring or
// calculation. Content comes from onboarding.fixture.ts.
export function RiskProfileScreen() {
  const router = useRouter();
  const [answer, setAnswer] = useState<string | null>(null);

  return (
    <StepScaffold
      step={data.step}
      totalSteps={ONBOARDING_WIREFRAME.totalSteps}
      title={data.title}
      description={data.intro}
      onBack={() => router.back()}
      primaryLabel="Continue"
      onPrimary={() => router.push("/(onboarding)/completion")}
      secondaryLabel="Previous"
      onSecondary={() => router.back()}
    >
      <Card>
        <Stack gap="md">
          <Text variant="caption" color={colors.textSecondary}>
            {data.questionCounter}
          </Text>
          <Text variant="cardTitle">{data.question}</Text>
          <RadioGroup options={[...data.options]} value={answer} onChange={setAnswer} />
        </Stack>
      </Card>
    </StepScaffold>
  );
}
