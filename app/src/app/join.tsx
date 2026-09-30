import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { inviteCodeSchema, type GroupWithMembers, type InvitePreview } from "@tsili/shared";
import { apiFetch, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { notifyDbChanged } from "../db/changes";
import { useDb } from "../db/DbProvider";
import { importGroup, syncGroup } from "../sync/engine";
import { useSync } from "../sync/SyncProvider";
import { Button } from "../ui/Button";
import { Chips } from "../ui/Chips";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

export default function JoinScreen() {
  const db = useDb();
  const auth = useAuth();
  const sync = useSync();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status !== "signedIn") {
    return (
      <Screen>
        <Text>Sign in first so the group knows who you are.</Text>
        <Button title="Go to account" onPress={() => router.replace("/account")} />
      </Screen>
    );
  }

  const normalized = code.trim().toUpperCase();

  async function lookUp() {
    setError(null);
    setPreview(null);
    if (!inviteCodeSchema.safeParse(normalized).success) {
      setError("Codes are 8 letters and digits, like KAZB2326");
      return;
    }
    setBusy(true);
    try {
      const p = await apiFetch<InvitePreview>(`/invites/${normalized}`, { tokens: auth.tokens });
      setPreview(p);
      if (p.alreadyMemberId) setMemberId(p.alreadyMemberId);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status === 404 ? "No group has this code" : describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!preview || !auth.user) return;
    setError(null);
    const body = memberId ? { memberId } : { name: newName.trim() };
    if (!memberId && newName.trim() === "") {
      setError("Pick your name from the list or type a new one");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<GroupWithMembers>(`/invites/${normalized}/join`, { body, tokens: auth.tokens });
      await importGroup(db, data, auth.user.id);
      notifyDbChanged();
      router.replace({ pathname: "/group/[groupId]", params: { groupId: data.group.id } });
      // Pull expenses in the background; the screen fills in when it lands.
      void syncGroup({ db, api: sync.api }, data.group.id).then(notifyDbChanged, () => undefined);
    } catch (err) {
      setError(describe(err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TextField
        label="Invite code"
        value={code}
        onChangeText={setCode}
        placeholder="KAZB2326"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        onSubmitEditing={() => void lookUp()}
      />
      {!preview ? <Button title={busy ? "Looking up…" : "Look up"} onPress={() => void lookUp()} disabled={busy} /> : null}
      {preview ? (
        <>
          <Section title="Group">
            <Text>{preview.group.name}</Text>
          </Section>
          {preview.alreadyMemberId ? (
            <Text variant="muted">You are already in this group.</Text>
          ) : (
            <Section title="Which one is you?">
              {preview.unclaimedMembers.length > 0 ? (
                <Chips
                  options={preview.unclaimedMembers.map((m) => ({ id: m.id, label: m.name }))}
                  selected={new Set(memberId ? [memberId] : [])}
                  onToggle={(id) => setMemberId((cur) => (cur === id ? null : id))}
                />
              ) : (
                <Text variant="muted">Nobody has been added for you yet.</Text>
              )}
              {!memberId ? <TextField label="Or join under a new name" value={newName} onChangeText={setNewName} placeholder={auth.user?.displayName ?? "Your name"} /> : null}
            </Section>
          )}
          <Button title={busy ? "Joining…" : preview.alreadyMemberId ? "Open group" : "Join"} onPress={() => void join()} disabled={busy} />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function describe(err: unknown): string {
  if (err instanceof ApiRequestError) return err.code === "NETWORK" ? "Cannot reach the server" : err.message;
  return err instanceof Error ? err.message : String(err);
}

const styles = StyleSheet.create({
  error: { color: "#9E2A2B" },
});
