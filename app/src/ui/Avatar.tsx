import { StyleSheet, Text, View } from "react-native";
import { avatarColor, useScheme } from "../theme";

interface Props {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 36 }: Props) {
  const scheme = useScheme();
  const { bg, fg } = avatarColor(name, scheme);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.initials, { color: fg, fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "700" },
});
