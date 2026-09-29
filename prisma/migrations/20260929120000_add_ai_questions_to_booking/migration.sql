-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "aiQuestions" JSONB,
  ADD COLUMN "aiQuestionsGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "aiQuestionsCount" INTEGER NOT NULL DEFAULT 0;