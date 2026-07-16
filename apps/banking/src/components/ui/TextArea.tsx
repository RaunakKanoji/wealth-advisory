import type { ComponentProps } from "react";

import { TextField } from "@/src/components/ui/TextField";

type TextAreaProps = ComponentProps<typeof TextField> & {
  rows?: number;
};

export function TextArea({ rows = 4, inputStyle, ...rest }: TextAreaProps) {
  return (
    <TextField
      multiline
      numberOfLines={rows}
      inputStyle={[{ minHeight: rows * 22, textAlignVertical: "top", paddingTop: 12 }, inputStyle]}
      {...rest}
    />
  );
}
