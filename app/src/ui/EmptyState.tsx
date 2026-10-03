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
      <Text style={styles.title}>{title}</Text>
      <Text variant="muted" style={styles.hint}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  title: { fontSize: 18, fontWeight: "600" },
  hint: { textAlign: "center", paddingHorizontal: spacing.lg },
});
