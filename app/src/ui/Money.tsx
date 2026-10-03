import type { Currency } from "@tsili/shared";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { formatMoney } from "../lib/format";
import { useLocale } from "../settings/SettingsProvider";
import { usePalette } from "../theme";

interface Props {
  amount: number;
  currency: Currency;
  /** Colour positive green and negative red, with an explicit plus sign. */
  signed?: boolean;
  style?: TextStyle;
}

export function Money({ amount, currency, signed = false, style }: Props) {
  const p = usePalette();
  const locale = useLocale();
  const color = !signed || amount === 0 ? p.text : amount > 0 ? p.success : p.danger;
  return <Text style={[styles.money, { color }, style]}>{formatMoney(amount, currency, locale, signed)}</Text>;
}

const styles = StyleSheet.create({
  money: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
