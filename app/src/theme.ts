import { useColorScheme } from "react-native";

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;

export interface Palette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  danger: string;
}

const light: Palette = {
  background: "#F6F4EF",
  surface: "#FFFFFF",
  text: "#1B1A17",
  muted: "#6F6B62",
  border: "#E3DFD6",
  accent: "#B4472F",
  onAccent: "#FFFFFF",
  danger: "#9E2A2B",
};

const dark: Palette = {
  background: "#141311",
  surface: "#1F1D1A",
  text: "#F2EFE8",
  muted: "#A39E93",
  border: "#2E2B26",
  accent: "#E0694C",
  onAccent: "#1B1A17",
  danger: "#E57373",
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
