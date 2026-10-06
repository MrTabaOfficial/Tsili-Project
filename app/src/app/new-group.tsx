import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { notifyDbChanged } from "../db/changes";
import { useDb } from "../db/DbProvider";
import { insertGroup } from "../db/repo/groups";
import { insertMember } from "../db/repo/members";
import { newId, nowIso } from "../lib/ids";
import { useT } from "../settings/SettingsProvider";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

export default function NewGroupScreen() {
  const db = useDb();
  const router = useRouter();
  const t = useT();
  const auth = useAuth();
  const [name, setName] = useState("");
  // Signed-in users already told us their name; everyone else types it.
  const [yourName, setYourName] = useState(auth.user?.displayName ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && name.trim() === "" ? t("newGroup.nameError") : null;
  const yourNameError = submitted && yourName.trim() === "" ? t("newGroup.yourNameError") : null;

  async function save() {
    setSubmitted(true);
    if (name.trim() === "" || yourName.trim() === "") return;
    setSaving(true);
    const groupId = newId();
    const myMemberId = newId();
    const now = nowIso();
    await db.transaction(async () => {
      await insertGroup(db, { id: groupId, name: name.trim(), currency: "GEL", now, myMemberId });
      await insertMember(db, { id: myMemberId, groupId, name: yourName.trim(), now });
    });
    notifyDbChanged();
    router.replace({ pathname: "/group/[groupId]", params: { groupId } });
  }

  return (
    <Screen>
      <TextField label={t("newGroup.name")} value={name} onChangeText={setName} placeholder={t("newGroup.namePlaceholder")} autoFocus error={nameError} />
      <TextField label={t("newGroup.yourName")} value={yourName} onChangeText={setYourName} placeholder="Luka" error={yourNameError} />
      <Text variant="caption">{t("newGroup.yourNameHint")}</Text>
      <Text variant="muted">{t("newGroup.currencyNote")}</Text>
      <Button title={saving ? t("newGroup.saving") : t("newGroup.create")} icon="checkmark" onPress={() => void save()} disabled={saving} />
    </Screen>
  );
}
