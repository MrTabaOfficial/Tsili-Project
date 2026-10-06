import { dateOnlySchema, MoneyError, parseTetri, type Expense } from "@tsili/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { getExpense, upsertExpense } from "../../../db/repo/expenses";
import { getGroup } from "../../../db/repo/groups";
import { listMembers } from "../../../db/repo/members";
import { useQuery } from "../../../db/useQuery";
import {
  emptySplitInputs,
  exactTotal,
  inputsFromRule,
  resolveSplit,
  tetriToText,
  type SplitInputs,
  type SplitMode,
} from "../../../domain/expenseForm";
import { formatMoney, localIsoDate } from "../../../lib/format";
import { newId, nowIso } from "../../../lib/ids";
import { useLocale, useT } from "../../../settings/SettingsProvider";
import { spacing, usePalette } from "../../../theme";
import { Button } from "../../../ui/Button";
import { Chips } from "../../../ui/Chips";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { SegmentedControl, type Segment } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

type Params = { groupId: string; expenseId?: string };

/** Adds a new expense, or edits an existing one when `expenseId` is given. */
export default function AddExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<Params>();
  const db = useDb();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const p = usePalette();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);
  const existing = useQuery((d) => (expenseId ? getExpense(d, expenseId) : Promise.resolve(null)), [expenseId]);
  const currency = group.data?.currency ?? "GEL";
  const editing = Boolean(expenseId);

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [payerId, setPayerId] = useState<string | null>(null);
  const [date, setDate] = useState(localIsoDate(0));
  const [splitInputs, setSplitInputs] = useState<SplitInputs | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fill the form once members (and, when editing, the expense) are known.
  useEffect(() => {
    if (!members.data || splitInputs !== null) return;
    if (editing && existing.loading) return;
    const memberIds = members.data.map((m) => m.id);
    const e = existing.data;
    if (e) {
      setDescription(e.description);
      setAmountText(tetriToText(e.amount));
      setPayerId(e.payerMemberId);
      setDate(e.date);
      setSplitInputs(inputsFromRule(e.splitRule, memberIds));
    } else {
      setSplitInputs(emptySplitInputs(memberIds));
      setPayerId((id) => id ?? group.data?.myMemberId ?? members.data?.[0]?.id ?? null);
    }
  }, [members.data, splitInputs, editing, existing.loading, existing.data, group.data]);

  const amount = useMemo(() => {
    try {
      return parseTetri(amountText);
    } catch (err) {
      if (err instanceof MoneyError) return null;
      throw err;
    }
  }, [amountText]);

  const preview = useMemo(() => (amount !== null && splitInputs ? resolveSplit(amount, splitInputs) : null), [amount, splitInputs]);

  const descriptionError = submitted && description.trim() === "" ? t("expense.error.description") : null;
  const amountError = submitted && (amount === null || amount === 0) ? t("expense.error.amount") : null;
  const payerError = submitted && !payerId ? t("expense.error.payer") : null;
  const dateError = submitted && !dateOnlySchema.safeParse(date).success ? t("expense.error.date") : null;

  const modes: Segment<SplitMode>[] = [
    { id: "equal", label: t("expense.split.equal") },
    { id: "exact", label: t("expense.split.exact") },
    { id: "shares", label: t("expense.split.shares") },
  ];
  const dateQuickPicks = [
    { id: localIsoDate(0), label: t("common.today") },
    { id: localIsoDate(-1), label: t("common.yesterday") },
  ];

  function update(patch: Partial<SplitInputs>) {
    setSplitInputs((s) => (s ? { ...s, ...patch } : s));
  }

  async function save() {
    setSubmitted(true);
    setSaveError(null);
    if (!splitInputs || !payerId || amount === null || amount === 0 || description.trim() === "") return;
    if (!dateOnlySchema.safeParse(date).success) return;
    const resolved = resolveSplit(amount, splitInputs);
    if (!resolved.ok) {
      setSaveError(t(resolved.errorKey));
      return;
    }
    const now = nowIso();
    const expense: Expense = {
      id: existing.data?.id ?? newId(),
      groupId,
      payerMemberId: payerId,
      amount,
      description: description.trim(),
      date,
      splitRule: resolved.rule,
      shares: resolved.shares,
      createdAt: existing.data?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    await upsertExpense(db, expense, true);
    notifyDbChanged();
    router.back();
  }

  const memberOptions = (members.data ?? []).map((m) => ({ id: m.id, label: m.name }));
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name ?? "?";

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? t("expense.editTitle") : t("expense.title") }} />
      <TextField
        label={t("expense.description")}
        value={description}
        onChangeText={setDescription}
        placeholder={t("expense.descriptionPlaceholder")}
        autoFocus={!editing}
        error={descriptionError}
      />
      <TextField
        label={t("expense.amount", { currency })}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="45.50"
        keyboardType="decimal-pad"
        error={amountError}
      />
      <View style={styles.dateBlock}>
        <TextField label={t("expense.date")} value={date} onChangeText={setDate} placeholder="2026-10-07" autoCapitalize="none" error={dateError} />
        <Chips options={dateQuickPicks} selected={new Set([date])} onToggle={setDate} />
      </View>

      <Section title={t("expense.paidBy")}>
        <Chips options={memberOptions} selected={new Set(payerId ? [payerId] : [])} onToggle={setPayerId} />
        {payerError ? <Text style={{ color: p.danger }}>{payerError}</Text> : null}
      </Section>

      <Section title={t("expense.split")}>
        <SegmentedControl segments={modes} value={splitInputs?.mode ?? "equal"} onChange={(id) => update({ mode: id })} />
        {splitInputs?.mode === "equal" ? (
          <Chips
            options={memberOptions}
            selected={splitInputs.participants}
            onToggle={(id) => {
              const next = new Set(splitInputs.participants);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              update({ participants: next });
            }}
          />
        ) : null}
        {splitInputs?.mode === "exact"
          ? members.data?.map((m) => (
              <TextField
                key={m.id}
                label={m.name}
                value={splitInputs.exactText[m.id] ?? ""}
                onChangeText={(text) => update({ exactText: { ...splitInputs.exactText, [m.id]: text } })}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            ))
          : null}
        {splitInputs?.mode === "exact" && amount !== null ? (
          <Text variant="muted">
            {t("expense.assigned", {
              assigned: formatMoney(exactTotal(splitInputs.exactText), currency, locale),
              total: formatMoney(amount, currency, locale),
            })}
          </Text>
        ) : null}
        {splitInputs?.mode === "shares"
          ? members.data?.map((m) => (
              <TextField
                key={m.id}
                label={t("expense.sharesFor", { name: m.name })}
                value={splitInputs.sharesText[m.id] ?? ""}
                onChangeText={(text) => update({ sharesText: { ...splitInputs.sharesText, [m.id]: text } })}
                placeholder="1"
                keyboardType="number-pad"
              />
            ))
          : null}
      </Section>

      {preview?.ok ? (
        <Section title={t("expense.eachOwes")}>
          <View style={styles.preview}>
            {Object.entries(preview.shares)
              .filter(([, share]) => share > 0)
              .map(([id, share]) => (
                <Text key={id} variant="muted">
                  {nameOf(id)}: {formatMoney(share, currency, locale)}
                </Text>
              ))}
          </View>
        </Section>
      ) : null}
      {saveError ? (
        <Text style={{ color: p.danger }}>{saveError}</Text>
      ) : preview && !preview.ok && amount !== null ? (
        <Text variant="muted">{t(preview.errorKey)}</Text>
      ) : null}

      <Button title={editing ? t("expense.saveChanges") : t("expense.save")} icon="checkmark" onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateBlock: { gap: spacing.sm },
  preview: { gap: spacing.xs },
});
