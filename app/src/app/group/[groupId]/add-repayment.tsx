import { dateOnlySchema, formatTetri, parseTetri, type Repayment } from "@tsili/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { getGroup } from "../../../db/repo/groups";
import { listMembers } from "../../../db/repo/members";
import { upsertRepayment } from "../../../db/repo/repayments";
import { useQuery } from "../../../db/useQuery";
import { localIsoDate } from "../../../lib/format";
import { newId, nowIso } from "../../../lib/ids";
import { useT } from "../../../settings/SettingsProvider";
import { spacing, usePalette } from "../../../theme";
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
  const t = useT();
  const p = usePalette();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);
  const currency = group.data?.currency ?? "GEL";

  // The settle-up plan pre-fills these; the user can still change them.
  const [fromId, setFromId] = useState<string | null>(params.fromId ?? null);
  const [toId, setToId] = useState<string | null>(params.toId ?? null);
  const [amountText, setAmountText] = useState(params.amount ? formatTetri(Number(params.amount), "GEL").replace(" GEL", "") : "");
  const [date, setDate] = useState(localIsoDate(0));
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  let amount: number | null = null;
  try {
    amount = parseTetri(amountText);
  } catch {
    amount = null;
  }

  const fromError = submitted && !fromId ? t("repayment.error.from") : null;
  const toError = submitted && (!toId || toId === fromId) ? t("repayment.error.to") : null;
  const amountError = submitted && (amount === null || amount === 0) ? t("repayment.error.amount") : null;
  const dateError = submitted && !dateOnlySchema.safeParse(date).success ? t("expense.error.date") : null;
  const dateQuickPicks = [
    { id: localIsoDate(0), label: t("common.today") },
    { id: localIsoDate(-1), label: t("common.yesterday") },
  ];

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
      <Section title={t("repayment.whoPaid")}>
        <Chips options={options} selected={new Set(fromId ? [fromId] : [])} onToggle={setFromId} />
        {fromError ? <Text style={{ color: p.danger }}>{fromError}</Text> : null}
      </Section>
      <Section title={t("repayment.toWhom")}>
        <Chips options={options.filter((o) => o.id !== fromId)} selected={new Set(toId ? [toId] : [])} onToggle={setToId} />
        {toError ? <Text style={{ color: p.danger }}>{toError}</Text> : null}
      </Section>
      <TextField label={t("expense.amount", { currency })} value={amountText} onChangeText={setAmountText} placeholder="40" keyboardType="decimal-pad" error={amountError} />
      <View style={styles.dateBlock}>
        <TextField label={t("expense.date")} value={date} onChangeText={setDate} autoCapitalize="none" error={dateError} />
        <Chips options={dateQuickPicks} selected={new Set([date])} onToggle={setDate} />
      </View>
      <TextField label={t("repayment.note")} value={note} onChangeText={setNote} placeholder={t("repayment.notePlaceholder")} />
      <Button title={t("repayment.title")} icon="checkmark" onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateBlock: { gap: spacing.sm },
});
