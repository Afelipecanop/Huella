import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const categoryTypeSchema = z.enum(["income", "expense"]);

export const categorySchema = z.object({
  id: idSchema,
  user_id: idSchema,
  parent_id: idSchema.nullable(), // subcategoría si tiene parent_id
  name: z.string().min(1),
  type: categoryTypeSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// user_id no viaja en el payload: lo determina el backend a partir de la
// identidad autenticada (header x-user-id por ahora, JWT más adelante).
export const createCategorySchema = categorySchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});

export const updateCategorySchema = createCategorySchema.partial();

export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
