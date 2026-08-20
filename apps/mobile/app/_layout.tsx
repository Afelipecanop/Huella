import "../global.css";
import { useFonts, Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";
import { Stack } from "expo-router";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lexend_600SemiBold, SourceSans3_400Regular });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Huella" }} />
      <Stack.Screen name="entry" options={{ presentation: "modal", title: "Nuevo gasto" }} />
      <Stack.Screen name="transaction/[id]" options={{ title: "Transacción" }} />
    </Stack>
  );
}
