import type { Params, TranslationKey } from "../i18n";
import { timeAgo } from "../lib/format";
import type { SyncStatus } from "./SyncProvider";

type T = (key: TranslationKey, params?: Params) => string;

export function describeSync(s: Pick<SyncStatus, "running" | "lastSyncedAt" | "lastError" | "pending">, t: T): string {
  if (s.running) return t("settings.syncing");
  if (s.lastError) return t("settings.syncFailed", { error: s.lastError });
  const pending = s.pending > 0 ? ` · ${t("settings.pending", { n: s.pending })}` : "";
  if (!s.lastSyncedAt) return `${t("settings.notSynced")}${pending}`;
  return `${t("settings.synced", { time: timeAgo(s.lastSyncedAt, t) })}${pending}`;
}
