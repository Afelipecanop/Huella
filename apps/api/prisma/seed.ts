import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { templates } from "@huella/bank-templates";

const prisma = new PrismaClient();

for (const template of templates) {
  await prisma.bankTemplate.upsert({
    where: { senderPattern: template.sender_pattern },
    update: {
      bankName: template.bank_name,
      country: template.country,
      extractionRules: template.extraction_rules,
    },
    create: {
      bankName: template.bank_name,
      country: template.country,
      senderPattern: template.sender_pattern,
      extractionRules: template.extraction_rules,
    },
  });
}

console.log(`Seed listo: ${templates.length} plantilla(s) de banco.`);

await prisma.$disconnect();
