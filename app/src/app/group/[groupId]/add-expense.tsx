import { dateOnlySchema, formatTetri, MoneyError, parseTetri, type Expense } from "@tsili/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { upsertExpense } from "../../../db/repo/expenses";
import { listMembers } from "../../../db/repo/members";
import { useQuery } from "../../../db/useQuery";
import { emptySplitInputs, exactTotal, resolveSplit, type SplitInputs, type SplitMode } from "../../../domain/expenseForm";
import { newId, nowIso, todayLocal } from "../../../lib/ids";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/Button";
import { Chips } from "../../../ui/Chips";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

const MODES: { id: SplitMode; label: string }[] = [
  { id: "equal", label: "Equally" },
  { id: "exact", label: "Exact amounts" },
  { id: "shares", label: "By shares" },
];

export default function AddExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const db = useDb();
  const router = useRouter();
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [payerId, setPayerId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [splitInputs, setSplitInputs] = useState<SplitInputs | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Participants default to everyone once the member list is known.
  useEffect(() => {
    if (members.data && splitInputs === null) {
      setSplitInputs(emptySplitInputs(members.data.map((m) => m.id)));
      setPayerId((id) => id ?? members.data?.[0]?.id ?? null);
    }
  }, [members.data, splitInputs]);

  const amount = useMemo(() => {
    try {
      return parseTetri(amountText);
    } catch (err) {
      return err instanceof MoneyError ? null : null;
    }
  }, [amountText]);

  const preview = useMemo(() => (amount !== null && splitInputs ? resolveSplit(amount, splitInputs) : null), [amount, splitInputs]);

  const descriptionError = submitted && description.trim() === "" ? "What was it for?" : null;
  const amountError = submitted && (amount === null || amount === 0) ? "Enter an amount like 45.50" : null;
  const payerError = submitted && !payerId ? "Who paid?" : null;
  const dateError = submitted && !dateOnlySchema.safeParse(date).success ? "Use YYYY-MM-DD" : null;

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
      setSaveError(resolved.error);
      return;
    }
    const now = nowIso();
    const expense: Expense = {
      id: newId(),
      groupId,
      payerMemberId: payerId,
      amount,
      description: description.trim(),
      date,
      splitRule: resolved.rule,
      shares: resolved.shares,
      createdAt: now,
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
      <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Khinkali" autoFocus error={descriptionError} />
      <TextField
        label="Amount (GEL)"
        value={amountText}
        onChangeText={setAmountText}
        placeholder="45.50"
        keyboardType="decimal-pad"
        error={amountError}
      />
      <TextField label="Date" value={date} onChangeText={setDate} placeholder="2026-10-07" autoCapitalize="none" error={dateError} />

      <Section title="Paid by">
        <Chips options={memberOptions} selected={new Set(payerId ? [payerId] : [])} onToggle={setPayerId} />
        {payerError ? <Text style={styles.error}>{payerError}</Text> : null}
      </Section>

      <Section title="Split">
        <Chips
          options={MODES}
          selected={new Set(splitInputs ? [splitInputs.mode] : [])}
          onToggle={(id) => update({ mode: id as SplitMode })}
        />
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
                onChangeText={(t) => update({ exactText: { ...splitInputs.exactText, [m.id]: t } })}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            ))
          : null}
        {splitInputs?.mode === "exact" && amount !== null ? (
          <Text variant="muted">
            {formatTetri(exactTotal(splitInputs.exactText), "GEL")} of {formatTetri(amount, "GEL")} assigned
          </Text>
        ) : null}
        {splitInputs?.mode === "shares"
          ? members.data?.map((m) => (
              <TextField
                key={m.id}
                label={`${m.name} shares`}
                value={splitInputs.sharesText[m.id] ?? ""}
                onChangeText={(t) => update({ sharesText: { ...splitInputs.sharesText, [m.id]: t } })}
                placeholder="1"
                keyboardType="number-pad"
              />
            ))
          : null}
      </Section>

      {preview?.ok ? (
        <Section title="Each person owes">
          <View style={styles.preview}>
            {Object.entries(preview.shares)
              .filter(([, share]) => share > 0)
              .map(([id, share]) => (
                <Text key={id} variant="muted">
                  {nameOf(id)}: {formatTetri(share, "GEL")}
                </Text>
              ))}
          </View>
        </Section>
      ) : null}
      {saveError ? (
        <Text style={styles.error}>{saveError}</Text>
      ) : preview && !preview.ok && amount !== null ? (
        <Text variant="muted">{preview.error}</Text>
      ) : null}

      <Button title="Save expense" onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#9E2A2B" },
  preview: { gap: spacing.xs },
});
