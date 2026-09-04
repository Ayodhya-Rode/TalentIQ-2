-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NONE', 'PENDING', 'PAID');

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "candidateProfileId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 100,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "employeeConfirmedAt" TIMESTAMP(3),
    "candidateConfirmedAt" TIMESTAMP(3),
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_slotId_key" ON "Booking"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_razorpayOrderId_key" ON "Booking"("razorpayOrderId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
