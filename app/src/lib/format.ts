import { formatTetri, type Currency } from "@tsili/shared";
import type { Locale, Params, TranslationKey } from "../i18n";

const LOCALE_TAG: Record<Locale, string> = { en: "en-GB", ka: "ka-GE" };

/** 1250 -> "₾12.50" (en) or "12,50 ₾" (ka). Falls back to the shared formatter if Intl lacks the locale. */
export function formatMoney(amount: number, currency: Currency, locale: Locale, signed = false): string {
  const sign = signed && amount > 0 ? "+" : "";
  try {
    const text = new Intl.NumberFormat(LOCALE_TAG[locale], {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
    return sign + text;
  } catch {
    return sign + formatTetri(amount, currency);
  }
}

/** "2026-10-07" -> "7 Oct 2026" / "7 ოქტ. 2026"; today and yesterday get words. The year is dropped when current. */
export function formatDate(isoDate: string, locale: Locale, t: (key: TranslationKey, params?: Params) => string, today = new Date()): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  const diffDays = Math.round((startOfDay(today).getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return t("common.today");
  if (diffDays === 1) return t("common.yesterday");
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      day: "numeric",
      month: "short",
      ...(y === today.getFullYear() ? {} : { year: "numeric" }),
    }).format(date);
  } catch {
    return isoDate;
  }
}

/** YYYY-MM-DD in local time for a date `offsetDays` from today. */
export function localIsoDate(offsetDays = 0, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeAgo(iso: string, t: (key: TranslationKey, params?: Params) => string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t("settings.justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("settings.minutesAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("settings.hoursAgo", { n: hours });
  return new Date(iso).toLocaleDateString();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
