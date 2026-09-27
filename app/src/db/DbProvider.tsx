import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { openExpoDb } from "./expo-sqlite";
import { migrate } from "./schema";
import type { SqlDb } from "./sql";

const DbContext = createContext<SqlDb | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SqlDb | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Could not open the local database.</Text>
        <Text style={styles.detail}>{error}</Text>
      </View>
    );
  }
  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

function describeOpenError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Access Handle")) {
    return "The database is locked by another tab or by a page that was just reloaded. Close other Tsili tabs, then close and reopen this one.";
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
