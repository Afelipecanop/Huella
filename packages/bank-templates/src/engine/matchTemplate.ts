import type { CreateBankTemplate } from "@huella/shared-types";

export function matchTemplate(
  sender: string,
  templates: CreateBankTemplate[],
): CreateBankTemplate | undefined {
  return templates.find((template) => new RegExp(template.sender_pattern).test(sender));
}
