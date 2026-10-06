import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { detectLocale, translate } from "../i18n";
import { usePalette } from "../theme";
import { openExpoDb } from "./expo-sqlite";
import { migrate } from "./schema";
import type { SqlDb } from "./sql";

const DbContext = createContext<SqlDb | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SqlDb | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = usePalette();

  useEffect(() => {
    let cancelled = false;
    openExpoDb()
      .then(async (opened) => {
        await migrate(opened);
        if (!cancelled) setDb(opened);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeOpenError(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    // Stored preferences are unreachable here, so the device language decides.
    const locale = detectLocale(getLocales()[0]?.languageCode);
    return (
      <View style={[styles.center, { backgroundColor: p.background }]}>
        <Text style={[styles.error, { color: p.text }]}>{translate(locale, "db.openFailed")}</Text>
        <Text style={[styles.detail, { color: p.muted }]}>{error}</Text>
      </View>
    );
  }
  if (!db) {
    return (
      <View style={[styles.center, { backgroundColor: p.background }]}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

function describeOpenError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Access Handle")) {
    return translate(detectLocale(getLocales()[0]?.languageCode), "db.locked");
  }
  return message;
}

export function useDb(): SqlDb {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb must be used inside DbProvider");
  return db;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  detail: { fontSize: 13, opacity: 0.7, textAlign: "center" },
});
