import { Text } from "react-native";

type MoneyProps = {
  amountCents: number;
  currency: string;
};

export function Money({ amountCents, currency }: MoneyProps) {
  const isNegative = amountCents < 0;
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

  return (
    <Text
      style={{ fontVariant: ["tabular-nums"] }}
      className={
        isNegative
          ? "text-destructive dark:text-dark-destructive font-bold"
          : "text-primary dark:text-dark-primary font-bold"
      }
    >
      {formatted}
    </Text>
  );
}
