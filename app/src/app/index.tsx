import { Link, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { listGroups } from "../db/repo/groups";
import { useQuery } from "../db/useQuery";
import { spacing } from "../theme";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

export default function GroupsScreen() {
  const router = useRouter();
  const groups = useQuery((db) => listGroups(db), []);

  return (
    <Screen>
      {groups.error ? <Text>{groups.error.message}</Text> : null}
      {groups.data && groups.data.length === 0 ? (
        <EmptyState title="No groups yet" hint="Start one for a trip or a flat, then invite the others." />
      ) : null}
      <View style={styles.list}>
        {groups.data?.map((g) => (
          <Link key={g.id} href={{ pathname: "/group/[groupId]", params: { groupId: g.id } }} asChild>
            <ListRow title={g.name} subtitle={g.inviteCode ? `Invite code ${g.inviteCode}` : "Not synced yet"} />
          </Link>
        ))}
      </View>
      <Button title="New group" onPress={() => router.push("/new-group")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
