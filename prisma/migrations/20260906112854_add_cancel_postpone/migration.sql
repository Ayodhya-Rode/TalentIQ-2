-- CreateEnum
CREATE TYPE "CancellationType" AS ENUM ('CANCEL', 'POSTPONE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "SlotStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "CancellationLog" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "CancellationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CancellationLog" ADD CONSTRAINT "CancellationLog_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
