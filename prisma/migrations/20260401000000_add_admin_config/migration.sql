-- CreateTable
CREATE TABLE "AdminConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "feedLocked" BOOLEAN NOT NULL DEFAULT false,
    "messagingLocked" BOOLEAN NOT NULL DEFAULT false,
    "sectionsJson" TEXT NOT NULL DEFAULT '{}',
    "rateLimitJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);
