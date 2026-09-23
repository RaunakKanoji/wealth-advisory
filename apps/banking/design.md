# IDBI Banking visual system

This document describes the visual rules currently used by the Expo application. The source of truth is [`components/theme/tokens.ts`](components/theme/tokens.ts); shared building blocks live in [`components/design-system`](components/design-system), and feature token files re-export the same semantic values for backward-compatible component APIs.

## Foundation

- Page background: `appColors.background` (`#F7F8FA`)
- Surfaces: `appColors.surface` and `appColors.surfaceMuted`
- Brand action: `appColors.primary` (`#008764`); pressed/strong action: `appColors.primaryPressed` (`#006B52`)
- Soft brand surface: `appColors.primarySoft`
- Primary text: `appColors.textPrimary`; body text: `appColors.textBody`; supporting text: `appColors.textSecondary`
- Orange shortcut accent: `appColors.orangeAccent`; readable orange text: `appColors.orangeText`
- Status colours are semantic and separate from the brand green: success, warning, danger, and info each have their own surface pairing.

## Layout

Use the spacing scale `4, 8, 12, 16, 20, 24, 32, 40, 48`. Standard mobile page padding is 20px, falling back to 16px below 375px. Major cards use the 20–24px radius family; controls use 12px; shortcut tiles use 18px. Keep bottom content clear of the safe-area-aware tab bar.

## Typography

The app uses the platform system sans-serif through React Native. Shared sizes are exposed as `appTypography`: page titles, section titles, card titles, body, supporting text, metadata, financial amounts, hero amounts, and buttons. Financial values continue to use the existing Indian currency formatters.

## Surfaces and controls

White cards use a subtle border and restrained surface shadow. The account hero uses the stronger diffuse hero shadow. Primary buttons use the pressed green; secondary controls use a white surface with the green border. Selected chips use the soft green surface. Orange is reserved primarily for shortcut icons and attention context, not generic errors.

Use `Surface` for standard, subtle, and brand surfaces; `PageHeader` for tab-page titles; `SectionHeader` for 20px section headings; `IconButton` for 44px icon actions; and `ProgressBar` for accessible goal progress. Accounts and Coach intentionally share the same refresh control and page-header geometry.

## Navigation

The shared `AppHeader` owns the IDBI logo, notifications, profile avatar, safe-area handling, and header separation. The tab shell owns Home, Accounts, Coach, and More with one active green treatment and readable neutral inactive labels. Focused flows may omit the tab bar, but should retain the same page background, header, controls, and state patterns.

## Patterns and states

Feature components remain domain-specific, while their surfaces, spacing, type, rows, controls, badges, loading blocks, dialogs, and empty/error states use the same tokens. A loading state should resemble the final content when practical. Error and unavailable states explain the limitation and expose a useful recovery action. The application does not claim pixel-perfect screenshot matching; responsive wrapping and platform safe-area differences are intentional accessibility adaptations.

The Wealth Coach overview orders its content by task priority: assistant composer, quick questions, monthly context, insights, goals, then recent conversations. Initial lists stay intentionally short; full goals, insights, and history use dedicated routes.
