import { colors } from "@/src/theme/colors";

// WCAG 2.1 relative luminance + contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio)
function relativeLuminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((pair) => parseInt(pair, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_LARGE_TEXT = 3;

describe("theme color contrast (WCAG 2.1 AA)", () => {
  const normalTextPairs: [string, string, string][] = [
    ["textPrimary on surface", colors.textPrimary, colors.surface],
    ["textPrimary on background", colors.textPrimary, colors.background],
    ["textPrimary on brandSecondarySoft", colors.textPrimary, colors.brandSecondarySoft],
    ["textSecondary on surface", colors.textSecondary, colors.surface],
    ["textSecondary on background", colors.textSecondary, colors.background],
    ["textInverse on brandPrimary", colors.textInverse, colors.brandPrimary],
    ["textInverse on brandPrimaryStrong", colors.textInverse, colors.brandPrimaryStrong],
    ["brandPrimary on surface", colors.brandPrimary, colors.surface],
    ["brandPrimary on brandPrimarySoft", colors.brandPrimary, colors.brandPrimarySoft],
    ["success on surface", colors.success, colors.surface],
    ["success on brandPrimarySoft", colors.success, colors.brandPrimarySoft],
    ["error on surface", colors.error, colors.surface],
    ["warning on surface", colors.warning, colors.surface],
    ["warning on warningSoft", colors.warning, colors.warningSoft],
    ["info on surface", colors.info, colors.surface],
    ["textInverse on brandSecondaryStrong", colors.textInverse, colors.brandSecondaryStrong],
    ["brandSecondaryStrong on surface", colors.brandSecondaryStrong, colors.surface],
    ["brandSecondaryStrong on background", colors.brandSecondaryStrong, colors.background],
    ["textInverse on gradientHero start", colors.textInverse, colors.gradientHero[0]],
    ["textInverse on gradientHero end", colors.textInverse, colors.gradientHero[1]],
  ];

  it.each(normalTextPairs)("%s meets 4.5:1", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  // Documented exceptions (see colors.ts): these tokens are restricted to
  // large-text or non-text roles because they cannot meet 4.5:1.
  it("textMuted meets large-text contrast on surface (large text / non-text use only)", () => {
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it("textMuted fails normal-text contrast — guard against promoting it to body copy", () => {
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(colors.textMuted, colors.background)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("brandSecondary fails text contrast on surface — decorative/large use only", () => {
    expect(contrastRatio(colors.brandSecondary, colors.surface)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(colors.textInverse, colors.brandSecondary)).toBeLessThan(AA_NORMAL_TEXT);
  });
});
