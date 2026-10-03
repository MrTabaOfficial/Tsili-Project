import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { spacing, usePalette } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** Header action. The label is for screen readers; the icon carries the meaning visually. */
export function IconButton({ icon, label, onPress }: Props) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.button}>
      <Ionicons name={icon} size={24} color={p.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The native-stack header gives headerRight no inset on web, so the button would touch the edge.
  button: { paddingHorizontal: spacing.md, minHeight: 44, justifyContent: "center" },
});
