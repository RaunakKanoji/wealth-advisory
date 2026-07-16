import type { ReactElement } from "react";
import { render as rtlRender } from "@testing-library/react-native";
import type { RenderOptions } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const frame = { width: 390, height: 844, x: 0, y: 0 };
const insets = { top: 0, left: 0, right: 0, bottom: 0 };

// RNTL v14's render() is async (React 19 concurrent-compatible test
// renderer) — callers must `await render(...)`.
export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>{ui}</SafeAreaProvider>,
    options,
  );
}
