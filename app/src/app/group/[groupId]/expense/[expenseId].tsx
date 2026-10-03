import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import { notifyDbChanged } from "../../../../db/changes";
import { useDb } from "../../../../db/DbProvider";
import { deleteExpense, getExpense } from "../../../../db/repo/expenses";
import { getGroup } from "../../../../db/repo/groups";
import { listMembers } from "../../../../db/repo/members";
import { useQuery } from "../../../../db/useQuery";
import { formatDate, formatMoney } from "../../../../lib/format";
import { nowIso } from "../../../../lib/ids";
import { useLocale, useT } from "../../../../settings/SettingsProvider";
import { Avatar } from "../../../../ui/Avatar";
import { Button } from "../../../../ui/Button";
import { EmptyState } from "../../../../ui/EmptyState";
import { ListRow } from "../../../../ui/ListRow";
import { Money } from "../../../../ui/Money";
import { Screen } from "../../../../ui/Screen";
import { Section } from "../../../../ui/Section";
import { Text } from "../../../../ui/Text";

export default function ExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const db = useDb();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const expense = useQuery((d) => getExpense(d, expenseId), [expenseId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);
  const currency = group.data?.currency ?? "GEL";
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name ?? t("common.formerMember");

  function confirmDelete() {
    Alert.alert(t("expense.delete"), t("expense.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
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
        {expense.loading ? null : <EmptyState icon="help-circle-outline" title={t("expense.notFound.title")} hint={t("expense.notFound.hint")} />}
      </Screen>
    );
  }

  const ruleTitle = { equal: t("expense.split.equal"), exact: t("expense.split.exact"), shares: t("expense.split.shares") }[e.splitRule.kind];
  const weightOf = (id: string) => (e.splitRule.kind === "shares" ? e.splitRule.weights[id] : undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title: e.description }} />
      <Text variant="title">{formatMoney(e.amount, currency, locale)}</Text>
      <Text variant="muted">{t("expense.paidOn", { payer: nameOf(e.payerMemberId), date: formatDate(e.date, locale, t) })}</Text>
      <Section title={ruleTitle}>
        {Object.entries(e.shares)
          .filter(([, share]) => share > 0)
          .map(([id, share]) => (
            <ListRow
              key={id}
              title={nameOf(id)}
              subtitle={weightOf(id) !== undefined ? t("expense.shareCount", { n: weightOf(id) ?? 0 }) : undefined}
              left={<Avatar name={nameOf(id)} />}
              right={<Money amount={share} currency={currency} />}
            />
          ))}
      </Section>
      <Button title={t("expense.delete")} icon="trash-outline" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}
