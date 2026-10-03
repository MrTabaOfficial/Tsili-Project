import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { loginRequestSchema, registerRequestSchema } from "@tsili/shared";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { LOCALES, type LocalePreference } from "../i18n";
import { useSettings, useT } from "../settings/SettingsProvider";
import { describeSync } from "../sync/describeSync";
import { useSync } from "../sync/SyncProvider";
import { spacing, usePalette, type ThemePreference } from "../theme";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Chips } from "../ui/Chips";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

const LANGUAGE_LABELS: Record<(typeof LOCALES)[number], string> = { en: "English", ka: "ქართული" };

export default function SettingsScreen() {
  const auth = useAuth();
  const sync = useSync();
  const settings = useSettings();
  const t = useT();
  const p = usePalette();

  const themeOptions: { id: ThemePreference; label: string }[] = [
    { id: "system", label: t("settings.theme.system") },
    { id: "light", label: t("settings.theme.light") },
    { id: "dark", label: t("settings.theme.dark") },
  ];
  const languageOptions: { id: LocalePreference; label: string }[] = [
    { id: "system", label: t("settings.language.system") },
    ...LOCALES.map((id) => ({ id, label: LANGUAGE_LABELS[id] })),
  ];

  return (
    <Screen>
      <Section title={t("settings.account")}>
        {auth.status === "signedIn" && auth.user ? (
          <>
            <ListRow title={auth.user.displayName} subtitle={auth.user.email} left={<Avatar name={auth.user.displayName} />} />
            <Button title={t("settings.signOut")} variant="danger" icon="log-out-outline" onPress={() => void auth.signOut()} />
          </>
        ) : (
          <AuthForm />
        )}
      </Section>

      <Section title={t("settings.appearance")}>
        <Chips options={themeOptions} selected={new Set([settings.themePreference])} onToggle={(id) => void settings.setThemePreference(id as ThemePreference)} />
      </Section>

      <Section title={t("settings.language")}>
        <Chips options={languageOptions} selected={new Set([settings.localePreference])} onToggle={(id) => void settings.setLocalePreference(id as LocalePreference)} />
      </Section>

      {auth.status === "signedIn" ? (
        <Section title={t("settings.sync")}>
          <Text variant="muted">{describeSync(sync.status, t)}</Text>
          {sync.status.rejected.map((r, i) => (
            <Text key={`${r.id ?? "?"}-${i}`} style={{ color: p.danger }}>
              {r.kind} {r.id ? r.id.slice(0, 8) : ""}: {r.message}
            </Text>
          ))}
          <Button
            title={sync.status.running ? t("settings.syncing") : t("settings.syncNow")}
            icon="sync-outline"
            variant="secondary"
            onPress={() => void sync.syncNow()}
            disabled={sync.status.running}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

type Mode = "signIn" | "register";

function AuthForm() {
  const auth = useAuth();
  const t = useT();
  const p = usePalette();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setFieldErrors({});
    const schema = mode === "register" ? registerRequestSchema : loginRequestSchema;
    const parsed = schema.safeParse(mode === "register" ? { email, password, displayName } : { email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setFieldErrors(next);
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await auth.register(parsed.data as { email: string; password: string; displayName: string });
      else await auth.signIn(parsed.data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.issues) {
          const next: Record<string, string> = {};
          for (const i of err.issues) next[i.path] = i.message;
          setFieldErrors(next);
        }
        setError(err.code === "NETWORK" ? t("common.networkError") : err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Chips
        options={[
          { id: "signIn", label: t("settings.signIn") },
          { id: "register", label: t("settings.createAccount") },
        ]}
        selected={new Set([mode])}
        onToggle={(id) => setMode(id as Mode)}
      />
      {mode === "register" ? (
        <TextField label={t("settings.yourName")} value={displayName} onChangeText={setDisplayName} placeholder="Luka" error={fieldErrors.displayName} />
      ) : null}
      <TextField
        label={t("settings.email")}
        value={email}
        onChangeText={setEmail}
        placeholder="luka@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={fieldErrors.email}
      />
      <TextField
        label={t("settings.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        error={fieldErrors.password}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text style={{ color: p.danger }}>{error}</Text> : null}
      <Button
        title={busy ? t("common.pleaseWait") : mode === "register" ? t("settings.createAccount") : t("settings.signIn")}
        icon={mode === "register" ? "person-add-outline" : "log-in-outline"}
        onPress={() => void submit()}
        disabled={busy}
      />
      <Text variant="muted">{t("settings.offlineNote")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
