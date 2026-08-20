import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAccounts } from "../src/hooks/useAccounts";
import { useCreateTransaction } from "../src/hooks/useCreateTransaction";

export default function EntryScreen() {
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const createTransaction = useCreateTransaction();

  // Auto-selecciona la cuenta cuando hay una sola: derivado en el render (no un
  // efecto) para que quede disponible en el mismo tick que el resto del form,
  // sin depender de que un useEffect ya haya corrido.
  const accountId =
    selectedAccountId ?? (accounts && accounts.length === 1 ? accounts[0].id : null);

  const amountValue = Number(amountText.replace(",", "."));
  const isAmountValid = amountText.length > 0 && !Number.isNaN(amountValue) && amountValue !== 0;
  const canSave = Boolean(accountId) && isAmountValid && !createTransaction.isPending;

  async function handleSave() {
    if (!accountId || !isAmountValid) return;
    // La entrada rápida siempre registra un gasto (monto negativo) — para
    // ingresos hay que editar la transacción después, no es el camino feliz.
    const amountCents = Math.round(Math.abs(amountValue) * 100) * -1;
    try {
      await createTransaction.mutateAsync({
        account_id: accountId,
        amount: amountCents,
        date: new Date().toISOString(),
      });
      router.back();
    } catch {
      // el error queda visible via createTransaction.isError
    }
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background p-4">
      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Monto</Text>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        className="text-foreground dark:text-dark-foreground text-3xl font-bold border-b border-border dark:border-dark-border pb-2 mb-6"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Cuenta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {(accounts ?? []).map((account) => (
          <Pressable
            key={account.id}
            onPress={() => setSelectedAccountId(account.id)}
            className={
              account.id === accountId
                ? "bg-primary dark:bg-dark-primary px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
                : "bg-surface dark:bg-dark-surface border border-border dark:border-dark-border px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
            }
          >
            <Text
              className={
                account.id === accountId
                  ? "text-white font-medium"
                  : "text-foreground dark:text-dark-foreground font-medium"
              }
            >
              {account.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {createTransaction.isError && (
        <Text className="text-destructive dark:text-dark-destructive mb-4">
          No pudimos guardar el gasto. Probá de nuevo.
        </Text>
      )}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        accessibilityState={{ disabled: !canSave }}
        className={
          canSave
            ? "bg-primary dark:bg-dark-primary rounded-lg min-h-[48px] items-center justify-center"
            : "bg-border dark:bg-dark-border rounded-lg min-h-[48px] items-center justify-center"
        }
      >
        <Text className="text-white font-bold text-base">
          {createTransaction.isPending ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>
    </View>
  );
}
