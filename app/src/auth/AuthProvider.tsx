import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest, TokenPair } from "@tsili/shared";
import { apiFetch, ApiRequestError, type TokenProvider } from "../api/client";
import { clearTokens, loadTokens, saveTokens } from "./tokenStore";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

export interface Auth {
  status: AuthStatus;
  user: PublicUser | null;
  tokens: TokenProvider;
  register(input: RegisterRequest): Promise<void>;
  signIn(input: LoginRequest): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const pair = useRef<TokenPair | null>(null);
  // One refresh at a time: parallel 401s must not each spend the single-use refresh token.
  const refreshing = useRef<Promise<string | null> | null>(null);

  const dropSession = useCallback(async () => {
    pair.current = null;
    await clearTokens();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const tokens = useMemo<TokenProvider>(
    () => ({
      async getAccessToken() {
        return pair.current?.accessToken ?? null;
      },
      refresh() {
        if (!refreshing.current) {
          refreshing.current = (async () => {
            const refreshToken = pair.current?.refreshToken;
            if (!refreshToken) return null;
            try {
              const next = await apiFetch<TokenPair>("/auth/refresh", { body: { refreshToken } });
              pair.current = next;
              await saveTokens(next);
              return next.accessToken;
            } catch (err) {
              if (err instanceof ApiRequestError && err.status === 401) await dropSession();
              return null;
            } finally {
              refreshing.current = null;
            }
          })();
        }
        return refreshing.current;
      },
    }),
    [dropSession],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadTokens();
      if (!stored) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      pair.current = stored;
      try {
        const me = await apiFetch<{ user: PublicUser }>("/me", { tokens });
        if (!cancelled) {
          setUser(me.user);
          setStatus("signedIn");
        }
      } catch (err) {
        // Offline: trust the stored session so the app still opens; a real 401 has already dropped it.
        if (!cancelled) setStatus(err instanceof ApiRequestError && err.status === 401 ? "signedOut" : "signedIn");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens]);

  const accept = useCallback(async (res: AuthResponse) => {
    pair.current = { accessToken: res.accessToken, refreshToken: res.refreshToken };
    await saveTokens(pair.current);
    setUser(res.user);
    setStatus("signedIn");
  }, []);

  const value = useMemo<Auth>(
    () => ({
      status,
      user,
      tokens,
      async register(input) {
        await accept(await apiFetch<AuthResponse>("/auth/register", { body: input }));
      },
      async signIn(input) {
        await accept(await apiFetch<AuthResponse>("/auth/login", { body: input }));
      },
      async signOut() {
        const refreshToken = pair.current?.refreshToken;
        if (refreshToken) {
          try {
            await apiFetch<void>("/auth/logout", { body: { refreshToken } });
          } catch {
            // Offline logout still clears the phone; the token expires on its own.
          }
        }
        await dropSession();
      },
    }),
    [status, user, tokens, accept, dropSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
