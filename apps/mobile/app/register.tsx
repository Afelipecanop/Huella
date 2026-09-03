import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { ApiError } from "../src/api/client";

// Moneda fija por ahora: no hay selector de moneda en el resto de la app
// todavía, así que registro tampoco lo expone.
const DEFAULT_CURRENCY = "COP";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.length > 0 && email.length > 0 && password.length >= 8 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password, default_currency: DEFAULT_CURRENCY });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la cuenta. Probá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background p-4 justify-center">
      <Text className="text-foreground dark:text-dark-foreground text-2xl font-bold mb-6">
        Crear cuenta
      </Text>

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Nombre</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Tu nombre"
        className="text-foreground dark:text-dark-foreground text-base border-b border-border dark:border-dark-border pb-2 mb-6"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="vos@ejemplo.com"
        className="text-foreground dark:text-dark-foreground text-base border-b border-border dark:border-dark-border pb-2 mb-6"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">
        Contraseña (mínimo 8 caracteres)
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        className="text-foreground dark:text-dark-foreground text-base border-b border-border dark:border-dark-border pb-2 mb-6"
      />

      {error && <Text className="text-destructive dark:text-dark-destructive mb-4">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityState={{ disabled: !canSubmit }}
        className={
          canSubmit
            ? "bg-primary dark:bg-dark-primary rounded-lg min-h-[48px] items-center justify-center mb-4"
            : "bg-border dark:bg-dark-border rounded-lg min-h-[48px] items-center justify-center mb-4"
        }
      >
        <Text className="text-white font-bold text-base">
          {isSubmitting ? "Creando..." : "Crear cuenta"}
        </Text>
      </Pressable>

      <Link href="/login" asChild>
        <Pressable className="min-h-[48px] items-center justify-center">
          <Text className="text-primary dark:text-dark-primary font-medium">
            ¿Ya tenés cuenta? Iniciá sesión
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
