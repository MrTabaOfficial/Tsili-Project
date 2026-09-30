import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { TokenPair } from "@tsili/shared";

const ACCESS_KEY = "tsili.accessToken";
const REFRESH_KEY = "tsili.refreshToken";

// SecureStore has no web implementation; localStorage is the best the browser offers.
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([storage.get(ACCESS_KEY), storage.get(REFRESH_KEY)]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function saveTokens(pair: TokenPair): Promise<void> {
  await Promise.all([storage.set(ACCESS_KEY, pair.accessToken), storage.set(REFRESH_KEY, pair.refreshToken)]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
}
