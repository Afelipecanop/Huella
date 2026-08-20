import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTransaction } from "../../src/hooks/useTransaction";
import { useUpdateTransaction } from "../../src/hooks/useUpdateTransaction";
import { useDeleteTransaction } from "../../src/hooks/useDeleteTransaction";
import { useCategories } from "../../src/hooks/useCategories";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: transaction, isLoading } = useTransaction(id);
  const { data: categories } = useCategories();
  const updateTransaction = useUpdateTransaction(id);
  const deleteTransaction = useDeleteTransaction();

  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (transaction) {
      setMerchant(transaction.merchant ?? "");
      setCategoryId(transaction.category_id);
    }
  }, [transaction]);

  if (isLoading || !transaction) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <Text className="text-muted-foreground dark:text-dark-muted-foreground">Cargando...</Text>
      </View>
    );
  }

  async function handleSave() {
    await updateTransaction.mutateAsync({
      merchant: merchant.length > 0 ? merchant : null,
      category_id: categoryId,
    });
    router.back();
  }

  async function handleDelete() {
    await deleteTransaction.mutateAsync(id);
    setConfirmingDelete(false);
    router.back();
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background p-4">
      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Comercio</Text>
      <TextInput
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Sin comercio"
        className="text-foreground dark:text-dark-foreground border-b border-border dark:border-dark-border pb-2 mb-6 min-h-[48px]"
      />

      <Text className="text-foreground dark:text-dark-foreground text-sm font-medium mb-2">Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {(categories ?? []).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => setCategoryId(category.id)}
            className={
              category.id === categoryId
                ? "bg-primary dark:bg-dark-primary px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
                : "bg-surface dark:bg-dark-surface border border-border dark:border-dark-border px-4 py-2 rounded-full mr-2 min-h-[48px] items-center justify-center"
            }
          >
            <Text
              className={
                category.id === categoryId
                  ? "text-white font-medium"
                  : "text-foreground dark:text-dark-foreground font-medium"
              }
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={handleSave}
        disabled={updateTransaction.isPending}
        className="bg-primary dark:bg-dark-primary rounded-lg min-h-[48px] items-center justify-center mb-4"
      >
        <Text className="text-white font-bold text-base">
          {updateTransaction.isPending ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setConfirmingDelete(true)}
        className="border border-destructive dark:border-dark-destructive rounded-lg min-h-[48px] items-center justify-center"
      >
        <Text className="text-destructive dark:text-dark-destructive font-bold text-base">Eliminar</Text>
      </Pressable>

      <Modal visible={confirmingDelete} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-surface dark:bg-dark-surface rounded-lg p-6 w-full">
            <Text className="text-foreground dark:text-dark-foreground text-base font-semibold mb-2">
              ¿Eliminar esta transacción?
            </Text>
            <Text className="text-muted-foreground dark:text-dark-muted-foreground mb-6">
              Esta acción no se puede deshacer.
            </Text>
            <View className="flex-row justify-end">
              <Pressable
                onPress={() => setConfirmingDelete(false)}
                className="px-4 py-2 min-h-[48px] items-center justify-center mr-2"
              >
                <Text className="text-foreground dark:text-dark-foreground">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="bg-destructive dark:bg-dark-destructive px-4 py-2 rounded-lg min-h-[48px] items-center justify-center"
              >
                <Text className="text-white font-bold">Eliminar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
