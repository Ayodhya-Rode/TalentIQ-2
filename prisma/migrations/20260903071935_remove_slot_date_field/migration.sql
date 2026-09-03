/*
  Warnings:

  - A unique constraint covering the columns `[employeeProfileId,startTime]` on the table `Slot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Slot_employeeProfileId_date_startTime_key";

-- CreateIndex
CREATE UNIQUE INDEX "Slot_employeeProfileId_startTime_key" ON "Slot"("employeeProfileId", "startTime");
