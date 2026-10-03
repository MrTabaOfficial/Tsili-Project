import { en, type TranslationKey } from "./en";
import { ka } from "./ka";

export type Locale = "en" | "ka";
export type LocalePreference = Locale | "system";
export const LOCALES: Locale[] = ["en", "ka"];
export type { TranslationKey };

export type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, ka };

const GEORGIAN = /[ა-ჿ]$/;
const GEORGIAN_VOWEL = /[აეიოუ]$/;

/** Per-language filters applied with `{param:filter}`. Latin names get a hyphen before the ending, as Georgian writes them. */
const filters: Record<Locale, Record<string, (value: string) => string>> = {
  en: {},
  ka: {
    dat: (name) => (GEORGIAN.test(name) ? `${name}ს` : `${name}-ს`),
    erg: (name) => {
      if (GEORGIAN_VOWEL.test(name)) return `${name}მ`;
      if (GEORGIAN.test(name)) return `${name}მა`;
      return `${name}-მ`;
    },
  },
};

export function translate(locale: Locale, key: TranslationKey, params?: Params): string {
  const template = dictionaries[locale][key] ?? en[key];
  return template.replace(/\{(\w+)(?::(\w+))?\}/g, (_match, name: string, filter?: string) => {
    const raw = params?.[name];
    const value = raw === undefined ? "" : String(raw);
    const fn = filter ? filters[locale][filter] : undefined;
    return fn ? fn(value) : value;
  });
}

/** Device language narrowed to what we ship; anything else falls back to English. */
export function detectLocale(languageCode: string | null | undefined): Locale {
  return languageCode === "ka" ? "ka" : "en";
}
