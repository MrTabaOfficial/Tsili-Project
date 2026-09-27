import { describe, expect, it } from "vitest";
import { emptySplitInputs, exactTotal, resolveSplit } from "./expenseForm";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("resolveSplit", () => {
  it("defaults to an equal split among everyone", () => {
    const result = resolveSplit(100, emptySplitInputs([A, B, C]));
    expect(result).toEqual({
      ok: true,
      rule: { kind: "equal", memberIds: [A, B, C] },
      shares: { [A]: 34, [B]: 33, [C]: 33 },
    });
  });

  it("equal split can exclude people and rejects nobody", () => {
    const inputs = emptySplitInputs([A, B, C]);
    inputs.participants.delete(C);
    expect(resolveSplit(100, inputs)).toMatchObject({ ok: true, shares: { [A]: 50, [B]: 50 } });
    inputs.participants.clear();
    expect(resolveSplit(100, inputs)).toEqual({ ok: false, error: "Pick at least one person" });
  });

  it("exact mode parses decimal text and reports a mismatch", () => {
    const inputs = emptySplitInputs([A, B]);
    inputs.mode = "exact";
    inputs.exactText = { [A]: "0.60", [B]: "0,40" };
    expect(resolveSplit(100, inputs)).toMatchObject({ ok: true, shares: { [A]: 60, [B]: 40 } });
    inputs.exactText = { [A]: "0.60", [B]: "0.30" };
    expect(resolveSplit(100, inputs)).toEqual({ ok: false, error: "The amounts must add up to the total" });
    inputs.exactText = { [A]: "abc", [B]: "1" };
    expect(resolveSplit(100, inputs)).toEqual({ ok: false, error: "Enter amounts like 12.50" });
  });

  it("shares mode uses whole-number weights and skips blanks", () => {
    const inputs = emptySplitInputs([A, B, C]);
    inputs.mode = "shares";
    inputs.sharesText = { [A]: "2", [B]: "1", [C]: "" };
    expect(resolveSplit(90, inputs)).toMatchObject({ ok: true, shares: { [A]: 60, [B]: 30 } });
    inputs.sharesText = { [A]: "1.5", [B]: "1" };
    expect(resolveSplit(90, inputs)).toEqual({ ok: false, error: "Shares must be whole numbers" });
    inputs.sharesText = { [A]: "0", [B]: "0" };
    expect(resolveSplit(90, inputs)).toEqual({ ok: false, error: "Give at least one person a share" });
  });
});

describe("exactTotal", () => {
  it("sums what parses and ignores what does not", () => {
    expect(exactTotal({ [A]: "1.50", [B]: "", [C]: "x" })).toBe(150);
  });
});
