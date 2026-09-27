import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { deleteGroup } from "../../../db/repo/groups";
import { deleteMember, listMembers } from "../../../db/repo/members";
import { useQuery } from "../../../db/useQuery";
import { nowIso } from "../../../lib/ids";
import { Button } from "../../../ui/Button";
import { ListRow } from "../../../ui/ListRow";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";

export default function MembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const db = useDb();
  const router = useRouter();
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);

  function confirmRemove(id: string, name: string) {
    Alert.alert("Remove member", `Remove ${name}? Their past expenses stay in the ledger.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void deleteMember(db, id, nowIso()).then(notifyDbChanged),
      },
    ]);
  }

  function confirmDeleteGroup() {
    Alert.alert("Delete group", "This hides the group on this phone and, once synced, for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void deleteGroup(db, groupId, nowIso()).then(() => {
            notifyDbChanged();
            router.dismissAll();
          }),
      },
    ]);
  }

  return (
    <Screen>
      <Section title="Members" right={<Text variant="muted">{members.data?.length ?? 0}</Text>}>
        {members.data?.map((m) => (
          <ListRow
            key={m.id}
            title={m.name}
            subtitle={m.userId ? "Joined with their account" : "Not joined yet"}
            right={<Button title="Remove" variant="danger" onPress={() => confirmRemove(m.id, m.name)} />}
          />
        ))}
        <Button
          title="Add member"
          variant="secondary"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-member", params: { groupId } })}
        />
      </Section>
      <Button title="Delete group" variant="danger" onPress={confirmDeleteGroup} />
    </Screen>
  );
}
