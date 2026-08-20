import "../global.css";
import { useFonts, Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts({ Lexend_600SemiBold, SourceSans3_400Regular });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Huella" }} />
        <Stack.Screen name="entry" options={{ presentation: "modal", title: "Nuevo gasto" }} />
        <Stack.Screen name="transaction/[id]" options={{ title: "Transacción" }} />
      </Stack>
    </QueryClientProvider>
  );
}
