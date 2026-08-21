-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "bank_template_id" TEXT;

-- CreateIndex
CREATE INDEX "accounts_bank_template_id_idx" ON "accounts"("bank_template_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_bank_template_id_fkey" FOREIGN KEY ("bank_template_id") REFERENCES "bank_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
