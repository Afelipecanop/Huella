import { Pressable, Text, View } from "react-native";
import type { Transaction } from "@huella/shared-types";
import { Money } from "./Money";

type TransactionRowProps = {
  transaction: Transaction;
  onPress: (id: string) => void;
};

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const dateLabel = new Date(transaction.date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Pressable
      onPress={() => onPress(transaction.id)}
      className="flex-row items-center justify-between px-4 py-3 min-h-[48px] border-b border-border dark:border-dark-border active:opacity-70"
    >
      <View className="flex-1 mr-3">
        <Text className="text-foreground dark:text-dark-foreground font-medium" numberOfLines={1}>
          {transaction.merchant ?? "Sin comercio"}
        </Text>
        <Text className="text-muted-foreground dark:text-dark-muted-foreground text-sm">
          {dateLabel}
        </Text>
      </View>
      <Money amountCents={transaction.amount} currency={transaction.currency} />
    </Pressable>
  );
}
