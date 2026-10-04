import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useDb } from "../db/DbProvider";
import { getSetting, setSetting } from "../db/repo/settings";
import { detectLocale, translate, type Locale, type LocalePreference, type Params, type TranslationKey } from "../i18n";
import { SchemeContext, type Scheme, type ThemePreference } from "../theme";

export interface Settings {
  themePreference: ThemePreference;
  localePreference: LocalePreference;
  locale: Locale;
  scheme: Scheme;
  setThemePreference(value: ThemePreference): Promise<void>;
  setLocalePreference(value: LocalePreference): Promise<void>;
}

const SettingsContext = createContext<Settings | null>(null);
const THEME_KEY = "theme";
const LOCALE_KEY = "locale";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const systemScheme = useColorScheme();
  const [themePreference, setTheme] = useState<ThemePreference>("system");
  const [localePreference, setLocale] = useState<LocalePreference>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSetting(db, THEME_KEY), getSetting(db, LOCALE_KEY)])
      .then(([theme, locale]) => {
        if (cancelled) return;
        if (theme === "light" || theme === "dark" || theme === "system") setTheme(theme);
        if (locale === "en" || locale === "ka" || locale === "system") setLocale(locale);
      })
      .catch((err: unknown) => {
        // Preferences are a convenience; the app must still open with defaults if they cannot be read.
        console.warn("settings unavailable, using defaults", err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const setThemePreference = useCallback(
    async (value: ThemePreference) => {
      setTheme(value);
      await setSetting(db, THEME_KEY, value);
    },
    [db],
  );
  const setLocalePreference = useCallback(
    async (value: LocalePreference) => {
      setLocale(value);
      await setSetting(db, LOCALE_KEY, value);
    },
    [db],
  );

  const value = useMemo<Settings>(
    () => ({
      themePreference,
      localePreference,
      locale: localePreference === "system" ? detectLocale(getLocales()[0]?.languageCode) : localePreference,
      scheme: themePreference === "system" ? (systemScheme === "dark" ? "dark" : "light") : themePreference,
      setThemePreference,
      setLocalePreference,
    }),
    [themePreference, localePreference, systemScheme, setThemePreference, setLocalePreference],
  );

  // Render nothing until stored preferences are known, so the first frame is not in the wrong theme.
  if (!loaded) return null;
  return (
    <SettingsContext.Provider value={value}>
      <SchemeContext.Provider value={value.scheme}>{children}</SchemeContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error("useSettings must be used inside SettingsProvider");
  return s;
}

export function useLocale(): Locale {
  return useSettings().locale;
}

/** The translation function for the current language. */
export function useT(): (key: TranslationKey, params?: Params) => string {
  const locale = useLocale();
  return useCallback((key: TranslationKey, params?: Params) => translate(locale, key, params), [locale]);
}
