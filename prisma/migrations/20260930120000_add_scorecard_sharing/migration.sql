-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "shareToken" TEXT,
  ADD COLUMN "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_shareToken_key" ON "Booking"("shareToken");