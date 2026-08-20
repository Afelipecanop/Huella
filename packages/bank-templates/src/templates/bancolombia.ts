import type { CreateBankTemplate } from "@huella/shared-types";

// Notificación de "Compra" de Bancolombia. Formato ilustrativo, fabricado a
// partir del shape público conocido de sus alertas transaccionales — no es
// un correo real. Ver src/fixtures/bancolombia-compra.ts para el fixture
// que este patrón está pensado para parsear.
export const bancolombiaTemplate: CreateBankTemplate = {
  bank_name: "Bancolombia",
  country: "CO",
  sender_pattern: "^alertasynotificaciones@bancolombia\\.com\\.co$",
  extraction_rules: [
    { field: "amount", pattern: "por \\$([\\d.,]+)", group: 1 },
    {
      field: "merchant",
      pattern: "por \\$[\\d.,]+ en (.+?) el \\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2}",
      group: 1,
    },
    { field: "date", pattern: "el (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
  ],
};
