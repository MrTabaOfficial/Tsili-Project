import { formatTetri, type Currency } from "@tsili/shared";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { usePalette } from "../theme";

interface Props {
  amount: number;
  currency: Currency;
  /** Colour positive green-ish and negative red; off for plain totals. */
  signed?: boolean;
  style?: TextStyle;
}

export function Money({ amount, currency, signed = false, style }: Props) {
  const p = usePalette();
  const color = !signed || amount === 0 ? p.text : amount > 0 ? "#2E7D4F" : p.danger;
  const text = signed && amount > 0 ? `+${formatTetri(amount, currency)}` : formatTetri(amount, currency);
  return <Text style={[styles.money, { color }, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  money: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
