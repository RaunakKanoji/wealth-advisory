import type { ComponentProps } from "react";

import { Text } from "@/src/components/ui/Text";

type HeadingLevel = "display" | "pageTitle" | "sectionTitle" | "cardTitle";

type HeadingProps = Omit<ComponentProps<typeof Text>, "variant"> & {
  level?: HeadingLevel;
};

export function Heading({ level = "pageTitle", ...rest }: HeadingProps) {
  return <Text variant={level} accessibilityRole="header" {...rest} />;
}
