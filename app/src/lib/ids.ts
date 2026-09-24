import * as Crypto from "expo-crypto";

/** Hermes has no crypto.randomUUID, so ids come from expo-crypto. */
export function newId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today as YYYY-MM-DD in the phone's local time zone, which is the date the user means. */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
