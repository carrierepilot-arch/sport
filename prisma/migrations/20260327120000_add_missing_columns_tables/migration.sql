-- AlterTable: add missing User column
ALTER TABLE "User" ADD COLUMN     "levelTestData" JSONB;

-- AlterTable: add missing Performance column
ALTER TABLE "Performance" ADD COLUMN     "videoStoragePath" TEXT;

-- CreateTable: SpotFavorite
CREATE TABLE "SpotFavorite" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiLog
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "apiName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responseStatus" INTEGER,
    "tokensUsed" INTEGER,
    "costEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Report
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExerciseTranslation
CREATE TABLE "ExerciseTranslation" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "translatedName" TEXT NOT NULL,
    "translatedDescription" TEXT,
    "gifUrl" TEXT,
    "instructionsFr" TEXT,
    "sourceApi" TEXT NOT NULL DEFAULT 'exerciseDB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpotFavorite_userId_idx" ON "SpotFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotFavorite_spotId_userId_key" ON "SpotFavorite"("spotId", "userId");

-- CreateIndex
CREATE INDEX "ApiLog_apiName_createdAt_idx" ON "ApiLog"("apiName", "createdAt");

-- CreateIndex
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_createdAt_idx" ON "Report"("reportedUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseTranslation_sourceName_key" ON "ExerciseTranslation"("sourceName");

-- AddForeignKey
ALTER TABLE "SpotFavorite" ADD CONSTRAINT "SpotFavorite_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotFavorite" ADD CONSTRAINT "SpotFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
