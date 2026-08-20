import { apiRequest } from "./client";
import type { Category } from "@huella/shared-types";

export function listCategories() {
  return apiRequest<Category[]>("/categories");
}
