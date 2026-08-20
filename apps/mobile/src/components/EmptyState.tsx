import { Pressable, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="text-foreground dark:text-dark-foreground text-lg font-semibold text-center">
        {title}
      </Text>
      <Text className="text-muted-foreground dark:text-dark-muted-foreground text-center mt-2">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="bg-primary dark:bg-dark-primary rounded-lg px-4 min-h-[48px] items-center justify-center mt-4"
        >
          <Text className="text-white font-bold text-base">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
