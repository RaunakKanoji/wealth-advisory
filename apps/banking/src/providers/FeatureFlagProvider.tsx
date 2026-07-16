import { createContext, useContext, type PropsWithChildren } from "react";

import { featureFlags, type FeatureFlagName, type FeatureFlags } from "@/src/config/featureFlags";

const FeatureFlagContext = createContext<FeatureFlags | null>(null);

type FeatureFlagProviderProps = PropsWithChildren<{
  /** Test-only override; production code always uses the build's resolved flags. */
  flags?: FeatureFlags;
}>;

export function FeatureFlagProvider({ children, flags = featureFlags }: FeatureFlagProviderProps) {
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlag(name: FeatureFlagName): boolean {
  const flags = useContext(FeatureFlagContext);
  if (!flags) {
    throw new Error("useFeatureFlag must be used within FeatureFlagProvider");
  }
  return flags[name];
}
