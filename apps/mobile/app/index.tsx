import { FlatList, RefreshControl, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTransactions } from "../src/hooks/useTransactions";
import { TransactionRow } from "../src/components/TransactionRow";
import { EmptyState } from "../src/components/EmptyState";
import { TransactionListSkeleton } from "../src/components/TransactionListSkeleton";

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useTransactions();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background dark:bg-dark-background">
        <TransactionListSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="No pudimos cargar tus gastos"
        message="Revisá tu conexión y volvé a intentar."
        actionLabel="Reintentar"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} onPress={(id) => router.push(`/transaction/${id}`)} />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no registraste gastos"
            message="Tocá el botón + para agregar el primero."
          />
        }
      />
      <Link
        href="/entry"
        className="absolute bottom-6 right-6 bg-primary dark:bg-dark-primary rounded-full w-14 h-14 items-center justify-center"
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </Link>
    </View>
  );
}
