import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { getGroup } from "../../../db/repo/groups";
import { useQuery } from "../../../db/useQuery";
import { useLedger } from "../../../domain/useLedger";
import { spacing, usePalette } from "../../../theme";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ListRow } from "../../../ui/ListRow";
import { Money } from "../../../ui/Money";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const p = usePalette();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const ledger = useLedger(groupId);

  if (group.data === null && !group.loading) {
    return (
      <Screen>
        <EmptyState title="Group not found" hint="It may have been deleted." />
      </Screen>
    );
  }
  const currency = group.data?.currency ?? "GEL";
  const L = ledger.data;
  const nameOf = (id: string) => L?.membersById.get(id)?.name ?? "Former member";
  const settled = L !== null && L !== undefined && L.plan.length === 0 && L.expenses.length > 0;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: group.data?.name ?? "",
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: "/group/[groupId]/members", params: { groupId } })} hitSlop={8}>
              <Text style={{ color: p.accent, fontWeight: "600" }}>Members</Text>
            </Pressable>
          ),
        }}
      />
      {ledger.error ? <Text>{ledger.error.message}</Text> : null}

      <Section title="Balances">
        {L?.members.map((m) => (
          <ListRow key={m.id} title={m.name} right={<Money amount={L.balances[m.id] ?? 0} currency={currency} signed />} />
        ))}
      </Section>

      <Section title="Settle up">
        {settled ? <Text variant="muted">Everyone is settled.</Text> : null}
        {L && L.expenses.length === 0 ? <Text variant="muted">Add an expense to see who owes whom.</Text> : null}
        {L?.plan.map((pay) => (
          <ListRow
            key={`${pay.fromId}-${pay.toId}`}
            title={`${nameOf(pay.fromId)} pays ${nameOf(pay.toId)}`}
            right={
              <View style={styles.planRight}>
                <Money amount={pay.amount} currency={currency} />
                <Button
                  title="Record"
                  variant="secondary"
                  style={styles.smallButton}
                  onPress={() =>
                    router.push({
                      pathname: "/group/[groupId]/add-repayment",
                      params: { groupId, fromId: pay.fromId, toId: pay.toId, amount: String(pay.amount) },
                    })
                  }
                />
              </View>
            }
          />
        ))}
      </Section>

      <View style={styles.actions}>
        <Button
          title="Add expense"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-expense", params: { groupId } })}
          style={styles.flex}
        />
        <Button
          title="Record payment"
          variant="secondary"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-repayment", params: { groupId } })}
          style={styles.flex}
        />
      </View>

      <Section title="Expenses" right={<Text variant="muted">{L?.expenses.length ?? 0}</Text>}>
        {L && L.expenses.length === 0 ? (
          <EmptyState title="Nothing yet" hint="Khinkali, taxi, rent: whatever someone paid for the group." />
        ) : null}
        {L?.expenses.map((e) => (
          <Link
            key={e.id}
            href={{ pathname: "/group/[groupId]/expense/[expenseId]", params: { groupId, expenseId: e.id } }}
            asChild
          >
            <ListRow
              title={e.description}
              subtitle={`${nameOf(e.payerMemberId)} paid · ${e.date}`}
              right={<Money amount={e.amount} currency={currency} />}
            />
          </Link>
        ))}
        {L && L.repayments.length > 0 ? <Text variant="heading">Payments</Text> : null}
        {L?.repayments.map((r) => (
          <ListRow
            key={r.id}
            title={`${nameOf(r.fromMemberId)} paid ${nameOf(r.toMemberId)}`}
            subtitle={r.note ? `${r.note} · ${r.date}` : r.date}
            right={<Money amount={r.amount} currency={currency} />}
          />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  planRight: { alignItems: "flex-end", gap: spacing.xs },
  smallButton: { minHeight: 32, paddingVertical: 4, paddingHorizontal: spacing.sm },
});
