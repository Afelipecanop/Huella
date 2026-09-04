-- AlterTable
ALTER TABLE "ingestion_events" ADD COLUMN     "message_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_events_message_id_key" ON "ingestion_events"("message_id");
