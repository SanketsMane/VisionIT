-- CreateEnum
CREATE TYPE "SupportPlan" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'CUSTOM');

-- CreateTable
CREATE TABLE "project_support" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plan" "SupportPlan" NOT NULL DEFAULT 'STANDARD',
    "planLabel" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 12,
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseTime" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "notes" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_support_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_support_projectId_key" ON "project_support"("projectId");

-- CreateIndex
CREATE INDEX "project_support_endDate_idx" ON "project_support"("endDate");

-- AddForeignKey
ALTER TABLE "project_support" ADD CONSTRAINT "project_support_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

