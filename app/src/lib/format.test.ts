import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import { formatDate, formatMoney, localIsoDate, timeAgo } from "./format";

const tEn = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate("en", key, params);
const tKa = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate("ka", key, params);

describe("formatMoney", () => {
  it("uses the lari symbol per locale and keeps two decimals", () => {
    expect(formatMoney(1250, "GEL", "en")).toBe("₾12.50");
    // ICU separates the symbol with a non-breaking space in Georgian; normalise before comparing.
    expect(formatMoney(1250, "GEL", "ka").replace(/\s/g, " ")).toBe("12,50 ₾");
    expect(formatMoney(5, "GEL", "en")).toBe("₾0.05");
  });

  it("adds a plus only when asked and only for positive amounts", () => {
    expect(formatMoney(1250, "GEL", "en", true)).toBe("+₾12.50");
    expect(formatMoney(-1250, "GEL", "en", true)).toBe("-₾12.50");
    expect(formatMoney(0, "GEL", "en", true)).toBe("₾0.00");
  });
});

describe("formatDate", () => {
  const today = new Date(2026, 9, 7); // 7 Oct 2026, local time

  it("says today and yesterday", () => {
    expect(formatDate("2026-10-07", "en", tEn, today)).toBe("Today");
    expect(formatDate("2026-10-06", "ka", tKa, today)).toBe("გუშინ");
  });

  it("drops the year when current and keeps it otherwise", () => {
    expect(formatDate("2026-10-01", "en", tEn, today)).toBe("1 Oct");
    expect(formatDate("2025-12-24", "en", tEn, today)).toBe("24 Dec 2025");
    expect(formatDate("2026-10-01", "ka", tKa, today)).toMatch(/^1 ოქტ\.?$/); // ICU versions differ on the trailing dot
  });

  it("returns malformed input unchanged", () => {
    expect(formatDate("nope", "en", tEn, today)).toBe("nope");
  });
});

describe("localIsoDate", () => {
  it("formats offsets in local time without timezone drift", () => {
    const today = new Date(2026, 0, 1);
    expect(localIsoDate(0, today)).toBe("2026-01-01");
    expect(localIsoDate(-1, today)).toBe("2025-12-31");
  });
});

describe("timeAgo", () => {
  it("picks the right unit", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(timeAgo("2026-10-07T11:59:40Z", tEn, now)).toBe("just now");
    expect(timeAgo("2026-10-07T11:45:00Z", tEn, now)).toBe("15 min ago");
    expect(timeAgo("2026-10-07T09:00:00Z", tKa, now)).toBe("3 სთ წინ");
  });
});
