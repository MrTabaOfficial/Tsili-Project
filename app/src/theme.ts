import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
/** Three radii by hierarchy: controls are pills, cards are soft, the hero is softer still. */
export const radius = { control: 999, card: 16, hero: 24, field: 14 } as const;

export const type = {
  display: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.8, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
} as const;

export type Scheme = "light" | "dark";
export type ThemePreference = Scheme | "system";

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  border: string;
  /** Saperavi garnet: the one strong colour, for the hero card and the primary action. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Chacha gold: only for the headline amount on the hero. */
  gold: string;
  danger: string;
  success: string;
}

const light: Palette = {
  background: "#F2F4F7",
  surface: "#FFFFFF",
  surfaceRaised: "#E8EBF0",
  text: "#171A21",
  muted: "#667085",
  border: "#DDE2EA",
  accent: "#7A1F3F",
  accentSoft: "#F5E6EC",
  onAccent: "#FFFFFF",
  gold: "#E0B04D",
  danger: "#D14343",
  success: "#2B8A5C",
};

const dark: Palette = {
  background: "#121318",
  surface: "#1B1D24",
  surfaceRaised: "#262933",
  text: "#F3F4F6",
  muted: "#98A2B3",
  border: "#2C303A",
  accent: "#8E2A4E",
  accentSoft: "#2E1A24",
  onAccent: "#FFFFFF",
  gold: "#EAC06A",
  danger: "#F0716A",
  success: "#4CC38A",
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

/** Stable muted hue per name for avatars; kept desaturated so they never compete with the accent. */
export function avatarColor(name: string, scheme: Scheme): { bg: string; fg: string } {
  const hues = [210, 170, 40, 280, 120, 330, 20];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hues[hash % hues.length] ?? 210;
  return scheme === "dark"
    ? { bg: `hsl(${hue} 22% 24%)`, fg: `hsl(${hue} 55% 78%)` }
    : { bg: `hsl(${hue} 45% 91%)`, fg: `hsl(${hue} 40% 32%)` };
}
