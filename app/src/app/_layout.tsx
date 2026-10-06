import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../auth/AuthProvider";
import { DbProvider } from "../db/DbProvider";
import { SettingsProvider, useT } from "../settings/SettingsProvider";
import { SyncProvider } from "../sync/SyncProvider";
import { usePalette, useScheme } from "../theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DbProvider>
        <SettingsProvider>
          <AuthProvider>
            <SyncProvider>
              <Shell />
            </SyncProvider>
          </AuthProvider>
        </SettingsProvider>
      </DbProvider>
    </SafeAreaProvider>
  );
}

/** Lives below the providers so header colours and titles follow the stored theme and language. */
function Shell() {
  const p = usePalette();
  const scheme = useScheme();
  const t = useT();
  // The navigator paints its theme background under screens while they animate; without this it is white.
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: p.background, card: p.background, text: p.text, primary: p.accent, border: p.border },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.background },
          headerTintColor: p.text,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: p.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: t("groups.title") }} />
        <Stack.Screen name="settings" options={{ title: t("settings.title"), presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: t("account.title"), presentation: "modal" }} />
        <Stack.Screen name="join" options={{ title: t("join.title"), presentation: "modal" }} />
        <Stack.Screen name="new-group" options={{ title: t("newGroup.title"), presentation: "modal" }} />
        <Stack.Screen name="group/[groupId]/index" options={{ title: "" }} />
        <Stack.Screen name="group/[groupId]/members" options={{ title: t("members.title") }} />
        <Stack.Screen name="group/[groupId]/add-member" options={{ title: t("addMember.title"), presentation: "modal" }} />
        <Stack.Screen name="group/[groupId]/add-expense" options={{ title: t("expense.title"), presentation: "modal" }} />
        <Stack.Screen name="group/[groupId]/add-repayment" options={{ title: t("repayment.title"), presentation: "modal" }} />
        <Stack.Screen name="group/[groupId]/expense/[expenseId]" options={{ title: "" }} />
      </Stack>
    </ThemeProvider>
  );
}
