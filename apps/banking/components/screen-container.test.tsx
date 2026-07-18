import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

import { ScreenContainer } from "./screen-container";

describe("ScreenContainer", () => {
  it("renders children correctly", async () => {
    const { getByText } = await render(
      <ScreenContainer>
        <Text>Test Content</Text>
      </ScreenContainer>
    );
    expect(getByText("Test Content")).toBeTruthy();
  });
});
