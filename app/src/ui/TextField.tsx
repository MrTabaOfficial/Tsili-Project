import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { radius, spacing, type as typeScale, usePalette } from "../theme";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string | null | undefined;
}

export function TextField({ label, error, ...input }: Props) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: p.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={p.muted}
        {...input}
        style={[styles.input, { color: p.text, backgroundColor: p.surface, borderColor: error ? p.danger : p.border }]}
      />
      {error ? <Text style={[styles.error, { color: p.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...typeScale.caption, paddingHorizontal: spacing.xs },
  input: {
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 5,
    borderWidth: 1,
    borderRadius: radius.field,
    minHeight: 50,
  },
  error: { ...typeScale.caption, paddingHorizontal: spacing.xs },
});
