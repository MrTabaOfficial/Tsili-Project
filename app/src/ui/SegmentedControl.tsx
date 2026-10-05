import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, type as typeScale, usePalette } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

export interface Segment<Id extends string> {
  id: Id;
  label: string;
  icon?: IconName;
}

interface Props<Id extends string> {
  segments: Segment<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}

/** One choice out of a few. The selected segment sits raised on a sunken track, so it reads as a control, not a label. */
export function SegmentedControl<Id extends string>({ segments, value, onChange }: Props<Id>) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={[styles.track, { backgroundColor: p.surfaceRaised }]}>
      {segments.map((s) => {
        const selected = s.id === value;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(s.id)}
            style={[styles.segment, selected && { backgroundColor: p.surface, shadowColor: "#000" }, selected && styles.selected]}
          >
            {s.icon ? <Ionicons name={s.icon} size={16} color={selected ? p.text : p.muted} /> : null}
            <Text numberOfLines={1} style={[styles.label, { color: selected ? p.text : p.muted }]}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: radius.control },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    minHeight: 40,
  },
  selected: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 },
  label: { ...typeScale.caption, fontSize: 14 },
});
