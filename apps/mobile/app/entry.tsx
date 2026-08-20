import { Text, View } from "react-native";

export default function EntryScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
      <Text className="text-foreground dark:text-dark-foreground">Entrada manual</Text>
    </View>
  );
}
