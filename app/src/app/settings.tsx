import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { type LocalePreference } from "../i18n";
import { useSettings, useT } from "../settings/SettingsProvider";
import { radius, spacing, usePalette, type ThemePreference } from "../theme";
import { Avatar } from "../ui/Avatar";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { SegmentedControl, type Segment } from "../ui/SegmentedControl";
import { Text } from "../ui/Text";

/** Preferences only. The account has its own screen because signing in is an action, not a setting. */
export default function SettingsScreen() {
  const settings = useSettings();
  const auth = useAuth();
  const router = useRouter();
  const t = useT();
  const p = usePalette();

  const themeSegments: Segment<ThemePreference>[] = [
    { id: "system", label: t("settings.theme.system"), icon: "phone-portrait-outline" },
    { id: "light", label: t("settings.theme.light"), icon: "sunny-outline" },
    { id: "dark", label: t("settings.theme.dark"), icon: "moon-outline" },
  ];
  const languageSegments: Segment<LocalePreference>[] = [
    { id: "system", label: t("settings.language.system") },
    { id: "en", label: "English" },
    { id: "ka", label: "ქართული" },
  ];

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Text variant="heading">{t("settings.appearance")}</Text>
        <SegmentedControl segments={themeSegments} value={settings.themePreference} onChange={(id) => void settings.setThemePreference(id)} />
      </View>
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Text variant="heading">{t("settings.language")}</Text>
        <SegmentedControl segments={languageSegments} value={settings.localePreference} onChange={(id) => void settings.setLocalePreference(id)} />
      </View>
      <ListRow
        title={auth.user ? auth.user.displayName : t("settings.signIn")}
        subtitle={auth.user ? auth.user.email : t("account.intro")}
        left={auth.user ? <Avatar name={auth.user.displayName} /> : <Ionicons name="person-circle-outline" size={28} color={p.accent} />}
        onPress={() => router.push("/account")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.card, borderWidth: 1, gap: spacing.md },
});
