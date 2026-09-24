import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, usePalette } from "../theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = "primary", disabled = false, style }: Props) {
  const p = usePalette();
  const colors = {
    primary: { bg: p.accent, fg: p.onAccent, border: p.accent },
    secondary: { bg: p.surface, fg: p.text, border: p.border },
    danger: { bg: "transparent", fg: p.danger, border: "transparent" },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  label: { fontSize: 16, fontWeight: "600" },
});
