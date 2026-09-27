import { formatTetri } from "@tsili/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import { notifyDbChanged } from "../../../../db/changes";
import { useDb } from "../../../../db/DbProvider";
import { deleteExpense, getExpense } from "../../../../db/repo/expenses";
import { listMembers } from "../../../../db/repo/members";
import { useQuery } from "../../../../db/useQuery";
import { nowIso } from "../../../../lib/ids";
import { Button } from "../../../../ui/Button";
import { EmptyState } from "../../../../ui/EmptyState";
import { ListRow } from "../../../../ui/ListRow";
import { Money } from "../../../../ui/Money";
import { Screen } from "../../../../ui/Screen";
import { Section } from "../../../../ui/Section";
import { Text } from "../../../../ui/Text";

const RULE_LABEL = { equal: "Split equally", exact: "Exact amounts", shares: "By shares" } as const;

export default function ExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const db = useDb();
  const router = useRouter();
  const expense = useQuery((d) => getExpense(d, expenseId), [expenseId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name ?? "Former member";

  function confirmDelete() {
    Alert.alert("Delete expense", "Balances will be recalculated without it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void deleteExpense(db, expenseId, nowIso()).then(() => {
            notifyDbChanged();
            router.back();
          }),
      },
    ]);
  }

  const e = expense.data;
  if (!e) {
    return (
      <Screen>
        {expense.loading ? null : <EmptyState title="Expense not found" hint="It may have been deleted." />}
      </Screen>
    );
  }

  const weightOf = (id: string) => (e.splitRule.kind === "shares" ? e.splitRule.weights[id] : undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title: e.description }} />
      <Text variant="title">{formatTetri(e.amount, "GEL")}</Text>
      <Text variant="muted">
        {nameOf(e.payerMemberId)} paid on {e.date}
      </Text>
      <Section title={RULE_LABEL[e.splitRule.kind]}>
        {Object.entries(e.shares)
          .filter(([, share]) => share > 0)
          .map(([id, share]) => (
            <ListRow
              key={id}
              title={nameOf(id)}
              subtitle={weightOf(id) !== undefined ? `${weightOf(id)} share${weightOf(id) === 1 ? "" : "s"}` : undefined}
              right={<Money amount={share} currency="GEL" />}
            />
          ))}
      </Section>
      <Button title="Delete expense" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}
