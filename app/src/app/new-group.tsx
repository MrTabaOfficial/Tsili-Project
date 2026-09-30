import { useRouter } from "expo-router";
import { useState } from "react";
import { notifyDbChanged } from "../db/changes";
import { useDb } from "../db/DbProvider";
import { insertGroup } from "../db/repo/groups";
import { insertMember } from "../db/repo/members";
import { newId, nowIso } from "../lib/ids";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";

export default function NewGroupScreen() {
  const db = useDb();
  const router = useRouter();
  const [name, setName] = useState("");
  const [yourName, setYourName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && name.trim() === "" ? "Give the group a name" : null;
  const yourNameError = submitted && yourName.trim() === "" ? "Add yourself as the first member" : null;

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
      <TextField label="Group name" value={name} onChangeText={setName} placeholder="Kazbegi trip" autoFocus error={nameError} />
      <TextField label="Your name" value={yourName} onChangeText={setYourName} placeholder="Luka" error={yourNameError} />
      <Text variant="muted">Currency: GEL. Everyone in the group shares one currency.</Text>
      <Button title={saving ? "Saving…" : "Create group"} onPress={() => void save()} disabled={saving} />
    </Screen>
  );
}
