-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "keywords" JSONB;

-- AlterTable
ALTER TABLE "Screening" ADD COLUMN     "Keywords" JSONB,
ADD COLUMN     "causeScores" JSONB,
ADD COLUMN     "conditionScores" JSONB;

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "avgScores" JSONB NOT NULL,
    "peakScores" JSONB NOT NULL,
    "peakEntryId" TEXT,
    "peakEntryType" TEXT,
    "dominantCondition" TEXT,
    "trend" TEXT,
    "thresholdCrossed" BOOLEAN NOT NULL DEFAULT false,
    "crossedClasses" JSONB,
    "keywordSummary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyAnalysisId" TEXT,
    "triggerSource" TEXT NOT NULL,
    "triggerRefId" TEXT,
    "conditionLabel" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "contactNotified" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAnalysis_userId_weekStart_key" ON "WeeklyAnalysis"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "Assessment_userId_createdAt_idx" ON "Assessment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Screening_userId_createdAt_idx" ON "Screening"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAnalysis" ADD CONSTRAINT "WeeklyAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_weeklyAnalysisId_fkey" FOREIGN KEY ("weeklyAnalysisId") REFERENCES "WeeklyAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
