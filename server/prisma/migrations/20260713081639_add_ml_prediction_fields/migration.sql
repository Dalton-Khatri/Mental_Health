-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "causeConfidence" DOUBLE PRECISION,
ADD COLUMN     "causeLabel" TEXT,
ADD COLUMN     "causeScores" JSONB,
ADD COLUMN     "conditionConfidence" DOUBLE PRECISION,
ADD COLUMN     "conditionLabel" TEXT,
ADD COLUMN     "conditionScores" JSONB,
ADD COLUMN     "depressionConfidence" DOUBLE PRECISION,
ADD COLUMN     "depressionPrediction" TEXT;
