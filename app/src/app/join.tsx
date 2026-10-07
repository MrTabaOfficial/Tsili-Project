import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { inviteCodeSchema, type GroupWithMembers, type InvitePreview } from "@tsili/shared";
import { apiFetch, ApiRequestError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AuthForm } from "./account";
import { notifyDbChanged } from "../db/changes";
import { useDb } from "../db/DbProvider";
import { useT } from "../settings/SettingsProvider";
import { importGroup, syncGroup } from "../sync/engine";
import { useSync } from "../sync/SyncProvider";
import { usePalette } from "../theme";
import { Button } from "../ui/Button";
import { Chips } from "../ui/Chips";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

/** Reached from the groups screen or from an invite link (tsili://join?code=...). */
export default function JoinScreen() {
  const db = useDb();
  const auth = useAuth();
  const sync = useSync();
  const router = useRouter();
  const t = useT();
  const p = usePalette();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? "");
  const [autoLookedUp, setAutoLookedUp] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = code.trim().toUpperCase();

  // A code that arrived in the link is looked up as soon as the user is signed in.
  useEffect(() => {
    if (auth.status === "signedIn" && params.code && !autoLookedUp) {
      setAutoLookedUp(true);
      void lookUp();
    }
  });

  if (auth.status !== "signedIn") {
    return (
      <Screen>
        <Text>{t("join.signInFirst")}</Text>
        <AuthForm />
      </Screen>
    );
  }

  function describe(err: unknown): string {
    if (err instanceof ApiRequestError) return err.code === "NETWORK" ? t("join.serverUnreachable") : err.message;
    return err instanceof Error ? err.message : String(err);
  }

  async function lookUp() {
    setError(null);
    setPreview(null);
    if (!inviteCodeSchema.safeParse(normalized).success) {
      setError(t("join.codeFormat"));
      return;
    }
    setBusy(true);
    try {
      const found = await apiFetch<InvitePreview>(`/invites/${normalized}`, { tokens: auth.tokens });
      setPreview(found);
      if (found.alreadyMemberId) setMemberId(found.alreadyMemberId);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status === 404 ? t("join.notFound") : describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!preview || !auth.user) return;
    setError(null);
    if (!memberId && newName.trim() === "") {
      setError(t("join.pickOrType"));
      return;
    }
    setBusy(true);
    try {
      const body = memberId ? { memberId } : { name: newName.trim() };
      const data = await apiFetch<GroupWithMembers>(`/invites/${normalized}/join`, { body, tokens: auth.tokens });
      await importGroup(db, data, auth.user.id);
      notifyDbChanged();
      router.replace({ pathname: "/group/[groupId]", params: { groupId: data.group.id } });
      // Expenses arrive in the background; the ledger fills in when they land.
      void syncGroup({ db, api: sync.api }, data.group.id).then(notifyDbChanged, () => undefined);
    } catch (err) {
      setError(describe(err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TextField
        label={t("join.code")}
        value={code}
        onChangeText={setCode}
        placeholder="KAZB2326"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        onSubmitEditing={() => void lookUp()}
      />
      {!preview ? <Button title={busy ? t("join.lookingUp") : t("join.lookUp")} icon="search-outline" onPress={() => void lookUp()} disabled={busy} /> : null}
      {preview ? (
        <>
          <Section title={t("join.group")}>
            <Text>{preview.group.name}</Text>
          </Section>
          {preview.alreadyMemberId ? (
            <Text variant="muted">{t("join.alreadyMember")}</Text>
          ) : (
            <Section title={t("join.whichIsYou")}>
              {preview.unclaimedMembers.length > 0 ? (
                <Chips
                  options={preview.unclaimedMembers.map((m) => ({ id: m.id, label: m.name }))}
                  selected={new Set(memberId ? [memberId] : [])}
                  onToggle={(id) => setMemberId((cur) => (cur === id ? null : id))}
                />
              ) : (
                <Text variant="muted">{t("join.nobodyYet")}</Text>
              )}
              {!memberId ? (
                <TextField label={t("join.newName")} value={newName} onChangeText={setNewName} placeholder={auth.user?.displayName ?? ""} />
              ) : null}
            </Section>
          )}
          <Button
            title={busy ? t("join.joining") : preview.alreadyMemberId ? t("join.open") : t("join.join")}
            icon="enter-outline"
            onPress={() => void join()}
            disabled={busy}
          />
        </>
      ) : null}
      {error ? <Text style={{ color: p.danger }}>{error}</Text> : null}
    </Screen>
  );
}
