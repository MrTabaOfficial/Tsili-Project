import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { spacing, usePalette } from "../theme";
import { Text } from "./Text";

type IconName = keyof typeof Ionicons.glyphMap;

export function EmptyState({ title, hint, icon = "leaf-outline" }: { title: string; hint: string; icon?: IconName }) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: p.accentSoft }]}>
        <Ionicons name={icon} size={28} color={p.accent} />
      </View>
      <Text variant="heading">{title}</Text>
      <Text variant="muted" style={styles.hint}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  hint: { textAlign: "center", paddingHorizontal: spacing.lg },
});
