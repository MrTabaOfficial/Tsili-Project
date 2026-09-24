import { useEffect, useState, type DependencyList } from "react";
import { useDbVersion } from "./changes";
import { useDb } from "./DbProvider";
import type { SqlDb } from "./sql";

export interface QueryState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Re-runs the query whenever its deps change or any local write happens. */
export function useQuery<T>(query: (db: SqlDb) => Promise<T>, deps: DependencyList): QueryState<T> {
  const db = useDb();
  const version = useDbVersion();
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    query(db)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, error: err instanceof Error ? err : new Error(String(err)), loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's query inputs
  }, [db, version, ...deps]);

  return state;
}
