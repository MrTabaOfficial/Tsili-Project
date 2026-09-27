import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DbProvider } from "../db/DbProvider";
import { usePalette } from "../theme";

export default function RootLayout() {
  const p = usePalette();
  return (
    <SafeAreaProvider>
      <DbProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: p.background },
            headerTintColor: p.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: p.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Groups" }} />
          <Stack.Screen name="new-group" options={{ title: "New group", presentation: "modal" }} />
          <Stack.Screen name="group/[groupId]/index" options={{ title: "" }} />
          <Stack.Screen name="group/[groupId]/add-member" options={{ title: "Add member", presentation: "modal" }} />
          <Stack.Screen name="group/[groupId]/members" options={{ title: "Members" }} />
          <Stack.Screen name="group/[groupId]/add-expense" options={{ title: "Add expense", presentation: "modal" }} />
          <Stack.Screen name="group/[groupId]/add-repayment" options={{ title: "Record payment", presentation: "modal" }} />
          <Stack.Screen name="group/[groupId]/expense/[expenseId]" options={{ title: "" }} />
        </Stack>
      </DbProvider>
    </SafeAreaProvider>
  );
}
