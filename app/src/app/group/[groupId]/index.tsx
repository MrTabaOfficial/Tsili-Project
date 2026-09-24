import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { deleteGroup, getGroup } from "../../../db/repo/groups";
import { deleteMember, listMembers } from "../../../db/repo/members";
import { useQuery } from "../../../db/useQuery";
import { nowIso } from "../../../lib/ids";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ListRow } from "../../../ui/ListRow";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const db = useDb();
  const router = useRouter();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);

  function confirmRemoveMember(id: string, name: string) {
    Alert.alert("Remove member", `Remove ${name} from the group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void deleteMember(db, id, nowIso()).then(notifyDbChanged);
        },
      },
    ]);
  }

  function confirmDeleteGroup() {
    Alert.alert("Delete group", "This hides the group on this phone and, once synced, for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteGroup(db, groupId, nowIso()).then(() => {
            notifyDbChanged();
            router.back();
          });
        },
      },
    ]);
  }

  if (group.data === null && !group.loading) {
    return (
      <Screen>
        <EmptyState title="Group not found" hint="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: group.data?.name ?? "" }} />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="heading">Members</Text>
          <Text variant="muted">{members.data?.length ?? 0}</Text>
        </View>
        {members.data?.map((m) => (
          <ListRow
            key={m.id}
            title={m.name}
            subtitle={m.userId ? "Joined" : undefined}
            onPress={() => confirmRemoveMember(m.id, m.name)}
          />
        ))}
        <Button
          title="Add member"
          variant="secondary"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-member", params: { groupId } })}
        />
      </View>
      <Button title="Delete group" variant="danger" onPress={confirmDeleteGroup} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
});
