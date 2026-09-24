import { useEffect, useState } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call after any local write so screens re-run their queries. Coarse on purpose: the data is tiny. */
export function notifyDbChanged(): void {
  for (const l of listeners) l();
}

export function useDbVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  return version;
}
