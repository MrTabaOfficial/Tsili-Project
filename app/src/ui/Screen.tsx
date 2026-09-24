import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, usePalette } from "../theme";

interface Props {
  children: ReactNode;
  /** Scrolls by default; lists that manage their own scrolling pass false. */
  scroll?: boolean;
}

export function Screen({ children, scroll = true }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const padding = { paddingBottom: insets.bottom + spacing.lg };
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, padding]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, padding]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
});
