import { View } from "react-native";

export function TransactionListSkeleton() {
  return (
    <View className="px-4 py-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          className="flex-row items-center justify-between py-3 border-b border-border dark:border-dark-border"
        >
          <View className="flex-1 mr-3">
            <View className="h-4 w-32 rounded bg-border dark:bg-dark-border mb-2" />
            <View className="h-3 w-16 rounded bg-border dark:bg-dark-border" />
          </View>
          <View className="h-4 w-20 rounded bg-border dark:bg-dark-border" />
        </View>
      ))}
    </View>
  );
}
