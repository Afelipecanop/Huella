import { z } from "zod";

export const idSchema = z.string().cuid2();

// ISO 4217, ej. "ARS", "USD"
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Debe ser un código de moneda ISO 4217 (3 letras mayúsculas)");

export const timestampSchema = z.string().datetime();

// Monto en la unidad mínima de la moneda (centavos), nunca float.
// $12.50 ARS -> 1250. El signo indica dirección: negativo = egreso, positivo = ingreso.
export const amountSchema = z.number().int();
