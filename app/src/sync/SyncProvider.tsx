import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { CreateGroupRequest, GroupWithMembers, SyncRejection, SyncRequest, SyncResponse } from "@tsili/shared";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { notifyDbChanged, useDbVersion } from "../db/changes";
import { useDb } from "../db/DbProvider";
import { countDirty } from "../db/repo/syncState";
import { syncAll, type SyncApi } from "./engine";

export interface SyncStatus {
  running: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  rejected: SyncRejection[];
  pending: number;
}

export interface Sync {
  status: SyncStatus;
  api: SyncApi;
  syncNow(): Promise<void>;
}

const SyncContext = createContext<Sync | null>(null);
const DEBOUNCE_MS = 2000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const auth = useAuth();
  const version = useDbVersion();
  const [status, setStatus] = useState<SyncStatus>({ running: false, lastSyncedAt: null, lastError: null, rejected: [], pending: 0 });
  const running = useRef(false);
  const signedIn = auth.status === "signedIn";

  const api = useMemo<SyncApi>(
    () => ({
      createGroup: (req: CreateGroupRequest) => apiFetch<GroupWithMembers>("/groups", { body: req, tokens: auth.tokens }),
      getGroup: (groupId: string) => apiFetch<GroupWithMembers>(`/groups/${groupId}`, { tokens: auth.tokens }),
      sync: (groupId: string, req: SyncRequest) => apiFetch<SyncResponse>(`/groups/${groupId}/sync`, { body: req, tokens: auth.tokens }),
    }),
    [auth.tokens],
  );

  const syncNow = useCallback(async () => {
    if (!signedIn || running.current) return;
    running.current = true;
    setStatus((s) => ({ ...s, running: true }));
    try {
      const { results, errors } = await syncAll({ db, api });
      const changed = results.some((r) => r.pulled > 0 || r.pushed > 0);
      setStatus((s) => ({
        ...s,
        running: false,
        lastSyncedAt: errors.length === 0 ? new Date().toISOString() : s.lastSyncedAt,
        lastError: errors[0]?.error.message ?? null,
        rejected: results.flatMap((r) => r.rejected),
      }));
      if (changed) notifyDbChanged();
    } catch (err) {
      setStatus((s) => ({ ...s, running: false, lastError: err instanceof Error ? err.message : String(err) }));
    } finally {
      running.current = false;
    }
  }, [db, api, signedIn]);

  // Pending count follows every local write.
  useEffect(() => {
    let cancelled = false;
    void countDirty(db).then((pending) => {
      if (!cancelled) setStatus((s) => (s.pending === pending ? s : { ...s, pending }));
    });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  // Sync shortly after local changes, on sign-in, and when the app returns to the foreground.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [signedIn, version, syncNow]);

  useEffect(() => {
    if (!signedIn) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => sub.remove();
  }, [signedIn, syncNow]);

  const value = useMemo<Sync>(() => ({ status, api, syncNow }), [status, api, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): Sync {
  const sync = useContext(SyncContext);
  if (!sync) throw new Error("useSync must be used inside SyncProvider");
  return sync;
}
