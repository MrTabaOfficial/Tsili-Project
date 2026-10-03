import { Link, Stack, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { listGroups, type LocalGroup } from "../db/repo/groups";
import type { SqlDb } from "../db/sql";
import { useQuery } from "../db/useQuery";
import { loadLedger } from "../domain/useLedger";
import { useT } from "../settings/SettingsProvider";
import { describeSync } from "../sync/describeSync";
import { useSync } from "../sync/SyncProvider";
import { spacing } from "../theme";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { ListRow } from "../ui/ListRow";
import { Money } from "../ui/Money";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

interface GroupCard {
  group: LocalGroup;
  memberCount: number;
  /** This phone's balance in the group, or null when the user has not picked a member yet. */
  mine: number | null;
}

async function loadCards(db: SqlDb): Promise<GroupCard[]> {
  const groups = await listGroups(db);
  return Promise.all(
    groups.map(async (group) => {
      const ledger = await loadLedger(db, group.id);
      return {
        group,
        memberCount: ledger.members.length,
        mine: group.myMemberId ? (ledger.balances[group.myMemberId] ?? 0) : null,
      };
    }),
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const t = useT();
  const auth = useAuth();
  const sync = useSync();
  const cards = useQuery(loadCards, []);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton icon="settings-outline" label={t("settings.title")} onPress={() => router.push("/settings")} />,
        }}
      />
      <Text variant="muted">{auth.status === "signedIn" ? describeSync(sync.status, t) : t("groups.signInHint")}</Text>
      {cards.error ? <Text>{cards.error.message}</Text> : null}
      {cards.data && cards.data.length === 0 ? (
        <EmptyState icon="people-outline" title={t("groups.empty.title")} hint={t("groups.empty.hint")} />
      ) : null}
      <View style={styles.list}>
        {cards.data?.map(({ group, memberCount, mine }) => (
          <Link key={group.id} href={{ pathname: "/group/[groupId]", params: { groupId: group.id } }} asChild>
            <ListRow
              title={group.name}
              subtitle={`${t("groups.members", { n: memberCount })} · ${group.inviteCode ?? t("groups.notSynced")}`}
              left={<Avatar name={group.name} size={40} />}
              right={mine !== null && mine !== 0 ? <Money amount={mine} currency={group.currency} signed /> : null}
            />
          </Link>
        ))}
      </View>
      <View style={styles.actions}>
        <Button title={t("groups.new")} icon="add" onPress={() => router.push("/new-group")} style={styles.flex} />
        <Button title={t("groups.join")} icon="enter-outline" variant="secondary" onPress={() => router.push("/join")} style={styles.flex} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
});
