import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";
import { notifyDbChanged } from "../../../db/changes";
import { useDb } from "../../../db/DbProvider";
import { deleteGroup, getGroup, renameGroup } from "../../../db/repo/groups";
import { deleteMember, listMembers } from "../../../db/repo/members";
import { useQuery } from "../../../db/useQuery";
import { nowIso } from "../../../lib/ids";
import { useT } from "../../../settings/SettingsProvider";
import { radius, spacing, usePalette } from "../../../theme";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { ListRow } from "../../../ui/ListRow";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const db = useDb();
  const router = useRouter();
  const t = useT();
  const p = usePalette();
  const group = useQuery((d) => getGroup(d, groupId), [groupId]);
  const members = useQuery((d) => listMembers(d, groupId), [groupId]);
  const [name, setName] = useState("");
  useEffect(() => {
    if (group.data) setName(group.data.name);
  }, [group.data]);
  const nameChanged = group.data !== null && name.trim() !== "" && name.trim() !== group.data?.name;
  const myId = group.data?.myMemberId ?? null;

  async function saveName() {
    if (!nameChanged) return;
    await renameGroup(db, groupId, name.trim(), nowIso());
    notifyDbChanged();
  }

  async function shareCode() {
    if (!group.data?.inviteCode) return;
    try {
      await Share.share({ message: t("members.shareMessage", { name: group.data.name, code: group.data.inviteCode }) });
    } catch {
      // The platform has no share sheet (web without navigator.share); the code is visible on screen anyway.
    }
  }

  function confirmRemove(id: string, memberName: string) {
    Alert.alert(t("members.removeTitle"), t("members.removeBody", { name: memberName }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.remove"), style: "destructive", onPress: () => void deleteMember(db, id, nowIso()).then(notifyDbChanged) },
    ]);
  }

  function confirmDeleteGroup() {
    Alert.alert(t("members.deleteGroup"), t("members.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () =>
          void deleteGroup(db, groupId, nowIso()).then(() => {
            notifyDbChanged();
            router.dismissAll();
          }),
      },
    ]);
  }

  return (
    <Screen>
      <Section title={t("members.groupSection")}>
        <TextField label={t("members.name")} value={name} onChangeText={setName} onSubmitEditing={() => void saveName()} />
        {nameChanged ? <Button title={t("members.saveName")} icon="checkmark" variant="secondary" onPress={() => void saveName()} /> : null}
        {group.data?.inviteCode ? (
          <View style={[styles.codeCard, { backgroundColor: p.accentSoft }]}>
            <Text variant="heading">{t("members.inviteCode")}</Text>
            <Text style={[styles.code, { color: p.text }]}>{group.data.inviteCode}</Text>
            <Text variant="muted">{t("members.inviteHint")}</Text>
            <Button title={t("members.share")} icon="share-outline" variant="secondary" onPress={() => void shareCode()} />
          </View>
        ) : (
          <Text variant="muted">{t("members.noInviteYet")}</Text>
        )}
      </Section>

      <Section title={t("members.section")} right={<Text variant="muted">{members.data?.length ?? 0}</Text>}>
        {members.data?.map((m) => (
          <ListRow
            key={m.id}
            title={m.id === myId ? `${m.name} (${t("common.you")})` : m.name}
            subtitle={m.userId ? t("members.joined") : t("members.notJoined")}
            left={<Avatar name={m.name} />}
            right={m.id === myId ? null : <Button title={t("common.remove")} variant="danger" onPress={() => confirmRemove(m.id, m.name)} />}
          />
        ))}
        <Button
          title={t("members.add")}
          icon="person-add-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: "/group/[groupId]/add-member", params: { groupId } })}
        />
      </Section>

      <Button title={t("members.deleteGroup")} icon="trash-outline" variant="danger" onPress={confirmDeleteGroup} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm },
  code: { fontSize: 32, fontWeight: "700", letterSpacing: 4, fontVariant: ["tabular-nums"] },
});
