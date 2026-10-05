import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, type as typeScale, usePalette } from "../theme";

export interface ChipOption {
  id: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/** Picking people. Selected chips fill with the accent and show a check, so the state is never ambiguous. */
export function Chips({ options, selected, onToggle }: Props) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = selected.has(o.id);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(o.id)}
            style={[styles.chip, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.border }]}
          >
            {on ? <Ionicons name="checkmark" size={16} color={p.onAccent} /> : null}
            <Text style={[styles.label, { color: on ? p.onAccent : p.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    minHeight: 40,
  },
  label: { ...typeScale.body, fontSize: 15, fontWeight: "500" },
});
