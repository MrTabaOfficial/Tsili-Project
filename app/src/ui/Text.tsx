import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { usePalette } from "../theme";

type Variant = "title" | "heading" | "body" | "muted";

export function Text({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  const p = usePalette();
  const color = variant === "muted" ? p.muted : p.text;
  return <RNText {...rest} style={[styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  heading: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { fontSize: 16 },
  muted: { fontSize: 15 },
});
