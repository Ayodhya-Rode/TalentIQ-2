-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "feedbackGivenAt" TIMESTAMP(3),
ADD COLUMN     "score" INTEGER;
