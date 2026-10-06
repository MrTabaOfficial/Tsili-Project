import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { getGroup } from "../../../db/repo/groups";
import { useQuery } from "../../../db/useQuery";
import { useLedger } from "../../../domain/useLedger";
import { formatDate, formatMoney } from "../../../lib/format";
import { useLocale, useT } from "../../../settings/SettingsProvider";
import { radius, spacing, usePalette } from "../../../theme";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { IconButton } from "../../../ui/IconButton";
import { ListRow } from "../../../ui/ListRow";
import { Money } from "../../../ui/Money";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const p = usePalette();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const ledger = useLedger(groupId);

  if (group.data === null && !group.loading) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title={t("group.notFound.title")} hint={t("group.notFound.hint")} />
      </Screen>
    );
  }
  const currency = group.data?.currency ?? "GEL";
  const myId = group.data?.myMemberId ?? null;
  const L = ledger.data;
  const nameOf = (id: string) => L?.membersById.get(id)?.name ?? t("common.formerMember");
  const withYou = (id: string) => (id === myId ? `${nameOf(id)} (${t("common.you")})` : nameOf(id));
  const mine = myId && L ? (L.balances[myId] ?? 0) : null;
  const totalSpent = L ? L.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: group.data?.name ?? "",
          headerRight: () => (
            <IconButton
              icon="settings-outline"
              label={t("group.settings")}
              onPress={() => router.push({ pathname: "/group/[groupId]/members", params: { groupId } })}
            />
          ),
        }}
      />
      {ledger.error ? <Text>{ledger.error.message}</Text> : null}

      {L && L.expenses.length > 0 ? (
        <View style={[styles.hero, { backgroundColor: p.accent }]}>
          <Text style={[styles.heroLabel, { color: p.onAccent }]}>
            {mine === null ? t("group.hero.total") : mine > 0 ? t("group.hero.owed") : mine < 0 ? t("group.hero.owe") : t("groups.settled")}
          </Text>
          {mine === null || mine !== 0 ? (
            <Text style={[styles.heroAmount, { color: p.gold }]}>{formatMoney(mine === null ? totalSpent : Math.abs(mine), currency, locale)}</Text>
          ) : null}
          {mine !== null ? (
            <Text style={[styles.heroFoot, { color: p.onAccent }]}>{t("group.totalSpent", { amount: formatMoney(totalSpent, currency, locale) })}</Text>
          ) : null}
        </View>
      ) : null}

      {L && L.expenses.length === 0 ? (
        <View style={[styles.start, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Text variant="heading">{t("group.start.title")}</Text>
          {[
            { icon: "people-outline" as const, text: t("group.start.members"), done: L.members.length > 1 },
            { icon: "receipt-outline" as const, text: t("group.start.expense"), done: false },
            { icon: "swap-horizontal-outline" as const, text: t("group.start.settle"), done: false },
          ].map((step) => (
            <View key={step.text} style={styles.step}>
              <Ionicons name={step.done ? "checkmark-circle" : step.icon} size={22} color={step.done ? p.success : p.accent} />
              <Text style={styles.flex}>{step.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Section title={t("group.balances")}>
        <Text variant="caption">{t("group.balancesHint")}</Text>
        {L?.members.map((m) => (
          <ListRow
            key={m.id}
            title={withYou(m.id)}
            left={<Avatar name={m.name} />}
            right={<Money amount={L.balances[m.id] ?? 0} currency={currency} signed />}
          />
        ))}
      </Section>

      <Section title={t("group.settleUp")}>
        {L && L.plan.length > 0 ? <Text variant="caption">{t("group.settleHint")}</Text> : null}
        {L && L.plan.length === 0 && L.expenses.length > 0 ? (
          <View style={styles.inline}>
            <Ionicons name="checkmark-circle" size={20} color={p.success} />
            <Text variant="muted">{t("group.everyoneSettled")}</Text>
          </View>
        ) : null}
        {L && L.expenses.length === 0 ? <Text variant="muted">{t("group.addExpenseHint")}</Text> : null}
        {L?.plan.map((pay) => (
          <ListRow
            key={`${pay.fromId}-${pay.toId}`}
            title={t("group.pays", { from: nameOf(pay.fromId), to: nameOf(pay.toId) })}
            left={<Avatar name={nameOf(pay.fromId)} />}
            right={
              <View style={styles.planRight}>
                <Money amount={pay.amount} currency={currency} />
                <Button
                  title={t("group.record")}
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
          title={t("group.addExpense")}
          icon="add"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-expense", params: { groupId } })}
          style={styles.flex}
        />
        <Button
          title={t("group.recordPayment")}
          icon="swap-horizontal-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-repayment", params: { groupId } })}
          style={styles.flex}
        />
      </View>

      <Section title={t("group.expenses")} right={<Text variant="muted">{L?.expenses.length ?? 0}</Text>}>
        {L && L.expenses.length === 0 ? (
          <EmptyState icon="receipt-outline" title={t("group.empty.title")} hint={t("group.empty.hint")} />
        ) : null}
        {L?.expenses.map((e) => (
          <Link
            key={e.id}
            href={{ pathname: "/group/[groupId]/expense/[expenseId]", params: { groupId, expenseId: e.id } }}
            asChild
          >
            <ListRow
              title={e.description}
              subtitle={`${t("group.paidBy", { payer: nameOf(e.payerMemberId) })}, ${formatDate(e.date, locale, t)}`}
              left={<Avatar name={nameOf(e.payerMemberId)} />}
              right={<Money amount={e.amount} currency={currency} />}
            />
          </Link>
        ))}
      </Section>

      {L && L.repayments.length > 0 ? (
        <Section title={t("group.payments")}>
          {L.repayments.map((r) => (
            <ListRow
              key={r.id}
              title={t("group.paidTo", { from: nameOf(r.fromMemberId), to: nameOf(r.toMemberId) })}
              subtitle={r.note ? `${r.note}, ${formatDate(r.date, locale, t)}` : formatDate(r.date, locale, t)}
              left={<Avatar name={nameOf(r.fromMemberId)} />}
              right={<Money amount={r.amount} currency={currency} />}
              onPress={() => router.push({ pathname: "/group/[groupId]/add-repayment", params: { groupId, repaymentId: r.id } })}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  start: { padding: spacing.md, borderRadius: radius.card, borderWidth: 1, gap: spacing.md },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  hero: { padding: spacing.lg, borderRadius: radius.hero, gap: spacing.xs },
  heroLabel: { fontSize: 15, fontWeight: "500", opacity: 0.85 },
  heroAmount: { fontSize: 36, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  heroFoot: { fontSize: 14, opacity: 0.8, marginTop: spacing.xs },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  planRight: { alignItems: "flex-end", gap: spacing.xs },
  smallButton: { minHeight: 32, paddingVertical: 4, paddingHorizontal: spacing.sm },
});
