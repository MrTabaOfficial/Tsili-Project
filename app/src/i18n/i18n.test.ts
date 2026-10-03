import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ka } from "./ka";
import { detectLocale, translate } from "./index";

describe("dictionaries", () => {
  it("Georgian covers every English key and has no empty strings", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof ka[key], key).toBe("string");
      expect(ka[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it("every placeholder in English also appears in Georgian", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(names(ka[key]), key).toEqual(names(en[key]));
    }
  });
});

describe("translate", () => {
  it("interpolates params", () => {
    expect(translate("en", "settings.synced", { time: "just now" })).toBe("Synced just now");
    expect(translate("en", "groups.members", { n: 3 })).toBe("3 members");
  });

  it("leaves unknown params empty rather than printing braces", () => {
    expect(translate("en", "settings.synced")).toBe("Synced ");
  });

  it("inflects Georgian names for the dative and ergative", () => {
    expect(translate("ka", "group.pays", { from: "ნინო", to: "ლუკა" })).toBe("ნინო უხდის ლუკას");
    expect(translate("ka", "group.pays", { from: "Nino", to: "Luka" })).toBe("Nino უხდის Luka-ს");
    expect(translate("ka", "group.paidBy", { payer: "ლუკა" })).toBe("გადაიხადა ლუკამ");
    expect(translate("ka", "group.paidBy", { payer: "დავით" })).toBe("გადაიხადა დავითმა");
    expect(translate("ka", "group.paidBy", { payer: "Luka" })).toBe("გადაიხადა Luka-მ");
  });

  it("English ignores filters", () => {
    expect(translate("en", "group.pays", { from: "Nino", to: "Luka" })).toBe("Nino pays Luka");
  });
});

describe("detectLocale", () => {
  it("maps device languages to the shipped ones", () => {
    expect(detectLocale("ka")).toBe("ka");
    expect(detectLocale("en")).toBe("en");
    expect(detectLocale("ru")).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
  });
});
