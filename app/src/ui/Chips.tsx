import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, usePalette } from "../theme";

export interface ChipOption {
  id: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/** Wrapping row of toggle chips. Works for single selection when the caller replaces the set. */
export function Chips({ options, selected, onToggle }: Props) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = selected.has(o.id);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(o.id)}
            style={[
              styles.chip,
              { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.border },
            ]}
          >
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  label: { fontSize: 15, fontWeight: "500" },
});
