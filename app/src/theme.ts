import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, xl: 28 } as const;

export type Scheme = "light" | "dark";
export type ThemePreference = Scheme | "system";

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  success: string;
  shadow: string;
}

const light: Palette = {
  background: "#F6F4EF",
  surface: "#FFFFFF",
  surfaceRaised: "#FBF8F2",
  text: "#1B1A17",
  muted: "#6F6B62",
  border: "#E6E1D8",
  accent: "#B4472F",
  accentSoft: "#F7E3DB",
  onAccent: "#FFFFFF",
  danger: "#9E2A2B",
  success: "#2E7D4F",
  shadow: "rgba(27, 26, 23, 0.08)",
};

const dark: Palette = {
  background: "#141311",
  surface: "#1F1D1A",
  surfaceRaised: "#262320",
  text: "#F2EFE8",
  muted: "#A39E93",
  border: "#2E2B26",
  accent: "#E0694C",
  accentSoft: "#3A241D",
  onAccent: "#1B1A17",
  danger: "#E57373",
  success: "#6CC592",
  shadow: "rgba(0, 0, 0, 0.35)",
};

/** Set by SettingsProvider from the stored preference; absent (null) means follow the system. */
export const SchemeContext = createContext<Scheme | null>(null);

export function useScheme(): Scheme {
  const chosen = useContext(SchemeContext);
  const system = useColorScheme();
  return chosen ?? (system === "dark" ? "dark" : "light");
}

export function usePalette(): Palette {
  return useScheme() === "dark" ? dark : light;
}

/** Stable pastel per name, for avatars. */
export function avatarColor(name: string, scheme: Scheme): { bg: string; fg: string } {
  const hues = [14, 36, 92, 160, 198, 262, 320];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hues[hash % hues.length] ?? 14;
  return scheme === "dark"
    ? { bg: `hsl(${hue} 30% 26%)`, fg: `hsl(${hue} 70% 80%)` }
    : { bg: `hsl(${hue} 60% 90%)`, fg: `hsl(${hue} 45% 30%)` };
}
