import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { loginRequestSchema, registerRequestSchema } from "@tsili/shared";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useSync } from "../sync/SyncProvider";
import { spacing } from "../theme";
import { Button } from "../ui/Button";
import { Chips } from "../ui/Chips";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

type Mode = "signIn" | "register";

export default function AccountScreen() {
  const auth = useAuth();
  const sync = useSync();

  if (auth.status === "signedIn" && auth.user) {
    return (
      <Screen>
        <Section title="Signed in as">
          <Text>{auth.user.displayName}</Text>
          <Text variant="muted">{auth.user.email}</Text>
        </Section>
        <Section title="Sync">
          <Text variant="muted">{describeSync(sync.status)}</Text>
          {sync.status.rejected.map((r, i) => (
            <Text key={`${r.id ?? "?"}-${i}`} style={styles.error}>
              {r.kind} {r.id ? r.id.slice(0, 8) : ""}: {r.message}
            </Text>
          ))}
          <Button title={sync.status.running ? "Syncing…" : "Sync now"} variant="secondary" onPress={() => void sync.syncNow()} disabled={sync.status.running} />
        </Section>
        <Button title="Sign out" variant="danger" onPress={() => void auth.signOut()} />
      </Screen>
    );
  }
  return <AuthForm />;
}

function AuthForm() {
  const auth = useAuth();
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
        setError(err.code === "NETWORK" ? "Cannot reach the server. Check the address in .env and your Wi-Fi." : err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Chips
        options={[
          { id: "signIn", label: "Sign in" },
          { id: "register", label: "Create account" },
        ]}
        selected={new Set([mode])}
        onToggle={(id) => setMode(id as Mode)}
      />
      {mode === "register" ? (
        <TextField label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="Luka" error={fieldErrors.displayName} />
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="luka@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={fieldErrors.email}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        error={fieldErrors.password}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"} onPress={() => void submit()} disabled={busy} />
      <View style={styles.note}>
        <Text variant="muted">Your groups stay on this phone either way. Signing in lets you sync them with other phones and share invite codes.</Text>
      </View>
    </Screen>
  );
}

export function describeSync(s: { running: boolean; lastSyncedAt: string | null; lastError: string | null; pending: number }): string {
  if (s.running) return "Syncing…";
  if (s.lastError) return `Last sync failed: ${s.lastError}`;
  const pending = s.pending > 0 ? ` · ${s.pending} change${s.pending === 1 ? "" : "s"} waiting` : "";
  if (!s.lastSyncedAt) return `Not synced yet${pending}`;
  return `Synced ${timeAgo(s.lastSyncedAt)}${pending}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  error: { color: "#9E2A2B" },
  note: { paddingTop: spacing.sm },
});
