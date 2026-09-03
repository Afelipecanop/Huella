import "../global.css";
import { useFonts, Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Mientras se lee la sesión guardada en SecureStore no sabemos todavía a
  // qué grupo de rutas pertenece el usuario — no renderizar nada evita un
  // parpadeo hacia /login antes de confirmar que sí hay sesión.
  if (isLoading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" options={{ title: "Huella" }} />
        <Stack.Screen name="entry" options={{ presentation: "modal", title: "Nuevo gasto" }} />
        <Stack.Screen name="transaction/[id]" options={{ title: "Transacción" }} />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
        <Stack.Screen name="register" options={{ title: "Crear cuenta" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts({ Lexend_600SemiBold, SourceSans3_400Regular });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
