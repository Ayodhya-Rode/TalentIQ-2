-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;