import * as Crypto from "expo-crypto";

/** Hermes has no crypto.randomUUID, so ids come from expo-crypto. */
export function newId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
