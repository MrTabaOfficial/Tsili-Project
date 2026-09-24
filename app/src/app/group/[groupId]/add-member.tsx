import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { insertMember } from "../../../db/repo/members";
import { newId, nowIso } from "../../../lib/ids";
import { Button } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

export default function AddMemberScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const db = useDb();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const error = submitted && name.trim() === "" ? "Enter a name" : null;

  async function save() {
    setSubmitted(true);
    if (name.trim() === "") return;
    await insertMember(db, { id: newId(), groupId, name: name.trim(), now: nowIso() });
    notifyDbChanged();
    router.back();
  }

  return (
    <Screen>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Nino" autoFocus error={error} onSubmitEditing={() => void save()} />
      <Text variant="muted">They can claim this name later when they join with the invite code.</Text>
      <Button title="Add" onPress={() => void save()} />
    </Screen>
  );
}
