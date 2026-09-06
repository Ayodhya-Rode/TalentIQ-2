-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RefundStatus" ADD VALUE 'PROCESSED';
ALTER TYPE "RefundStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "razorpayRefundId" TEXT;
