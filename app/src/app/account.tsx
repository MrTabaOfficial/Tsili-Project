import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { loginRequestSchema, registerRequestSchema } from "@tsili/shared";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../settings/SettingsProvider";
import { describeSync } from "../sync/describeSync";
import { useSync } from "../sync/SyncProvider";
import { radius, spacing, usePalette } from "../theme";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

export default function AccountScreen() {
  const auth = useAuth();
  const sync = useSync();
  const t = useT();
  const p = usePalette();

  if (auth.status === "signedIn" && auth.user) {
    return (
      <Screen>
        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={styles.identity}>
            <Avatar name={auth.user.displayName} size={52} />
            <View style={styles.flex}>
              <Text variant="title">{auth.user.displayName}</Text>
              <Text variant="muted">{auth.user.email}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Text variant="heading">{t("settings.sync")}</Text>
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
        </View>
        <Button title={t("settings.signOut")} variant="danger" icon="log-out-outline" onPress={() => void auth.signOut()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <AuthForm />
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
      <Text variant="muted">{t("account.intro")}</Text>
      <SegmentedControl<Mode>
        segments={[
          { id: "signIn", label: t("settings.signIn") },
          { id: "register", label: t("settings.createAccount") },
        ]}
        value={mode}
        onChange={setMode}
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
      <Text variant="caption">{t("settings.offlineNote")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.card, borderWidth: 1, gap: spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  form: { gap: spacing.md },
});
