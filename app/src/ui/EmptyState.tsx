import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { Text } from "./Text";

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text variant="muted" style={styles.hint}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "600" },
  hint: { textAlign: "center" },
});
