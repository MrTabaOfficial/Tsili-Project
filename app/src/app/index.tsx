import { Link, Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { listGroups } from "../db/repo/groups";
import { useSync } from "../sync/SyncProvider";
import { describeSync } from "./account";
import { useQuery } from "../db/useQuery";
import { spacing, usePalette } from "../theme";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

export default function GroupsScreen() {
  const router = useRouter();
  const p = usePalette();
  const auth = useAuth();
  const sync = useSync();
  const groups = useQuery((db) => listGroups(db), []);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push("/account")} hitSlop={8} style={styles.headerButton}>
              <Text style={{ color: p.accent, fontWeight: "600" }}>{auth.status === "signedIn" ? "Account" : "Sign in"}</Text>
            </Pressable>
          ),
        }}
      />
      <Text variant="muted">{auth.status === "signedIn" ? describeSync(sync.status) : "Sign in to sync with other phones."}</Text>
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
      <View style={styles.actions}>
        <Button title="New group" onPress={() => router.push("/new-group")} style={styles.flex} />
        <Button title="Join with code" variant="secondary" onPress={() => router.push("/join")} style={styles.flex} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  headerButton: { paddingHorizontal: spacing.md },
});
