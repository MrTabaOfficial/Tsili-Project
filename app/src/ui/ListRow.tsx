import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, usePalette } from "../theme";

interface Props {
  title: string;
  subtitle?: string | undefined;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: (() => void) | undefined;
}

export function ListRow({ title, subtitle, left, right, onPress }: Props) {
  const p = usePalette();
  const body = (
    <View style={[styles.row, { backgroundColor: p.surface, borderColor: p.border, shadowColor: p.shadow }]}>
      {left}
      <View style={styles.text}>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: p.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    borderWidth: 1,
    borderRadius: radius.md,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "500" },
  subtitle: { fontSize: 14 },
});
