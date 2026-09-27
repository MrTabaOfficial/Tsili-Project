import { dateOnlySchema, formatTetri, parseTetri, type Repayment } from "@tsili/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { listMembers } from "../../../db/repo/members";
import { upsertRepayment } from "../../../db/repo/repayments";
import { useQuery } from "../../../db/useQuery";
import { newId, nowIso, todayLocal } from "../../../lib/ids";
import { Button } from "../../../ui/Button";
import { Chips } from "../../../ui/Chips";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

type Params = { groupId: string; fromId?: string; toId?: string; amount?: string };

export default function AddRepaymentScreen() {
  const params = useLocalSearchParams<Params>();
  const { groupId } = params;
  const db = useDb();
  const router = useRouter();
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);

  // The settle-up plan pre-fills these; the user can still change them.
  const [fromId, setFromId] = useState<string | null>(params.fromId ?? null);
  const [toId, setToId] = useState<string | null>(params.toId ?? null);
  const [amountText, setAmountText] = useState(params.amount ? formatTetri(Number(params.amount), "GEL").replace(" GEL", "") : "");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  let amount: number | null = null;
  try {
    amount = parseTetri(amountText);
  } catch {
    amount = null;
  }

  const fromError = submitted && !fromId ? "Who paid?" : null;
  const toError = submitted && (!toId || toId === fromId) ? "Who received it?" : null;
  const amountError = submitted && (amount === null || amount === 0) ? "Enter an amount like 40" : null;
  const dateError = submitted && !dateOnlySchema.safeParse(date).success ? "Use YYYY-MM-DD" : null;

  async function save() {
    setSubmitted(true);
    if (!fromId || !toId || toId === fromId || amount === null || amount === 0) return;
    if (!dateOnlySchema.safeParse(date).success) return;
    const now = nowIso();
    const repayment: Repayment = {
      id: newId(),
      groupId,
      fromMemberId: fromId,
      toMemberId: toId,
      amount,
      date,
      note: note.trim() === "" ? null : note.trim(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await upsertRepayment(db, repayment, true);
    notifyDbChanged();
    router.back();
  }

  const options = (members.data ?? []).map((m) => ({ id: m.id, label: m.name }));

  return (
    <Screen>
      <Section title="Who paid">
        <Chips options={options} selected={new Set(fromId ? [fromId] : [])} onToggle={setFromId} />
        {fromError ? <Text style={styles.error}>{fromError}</Text> : null}
      </Section>
      <Section title="To whom">
        <Chips options={options.filter((o) => o.id !== fromId)} selected={new Set(toId ? [toId] : [])} onToggle={setToId} />
        {toError ? <Text style={styles.error}>{toError}</Text> : null}
      </Section>
      <TextField label="Amount (GEL)" value={amountText} onChangeText={setAmountText} placeholder="40" keyboardType="decimal-pad" error={amountError} />
      <TextField label="Date" value={date} onChangeText={setDate} autoCapitalize="none" error={dateError} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Cash at the bus station" />
      <Button title="Record payment" onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#9E2A2B" },
});
