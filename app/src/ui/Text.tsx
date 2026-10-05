import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { type as typeScale, usePalette } from "../theme";

type Variant = "display" | "title" | "heading" | "body" | "muted" | "caption";

export function Text({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  const p = usePalette();
  const color = variant === "muted" || variant === "caption" ? p.muted : p.text;
  return <RNText {...rest} style={[styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  display: typeScale.display,
  title: typeScale.title,
  heading: typeScale.heading,
  body: typeScale.body,
  muted: { ...typeScale.body, fontSize: 15 },
  caption: typeScale.caption,
});
