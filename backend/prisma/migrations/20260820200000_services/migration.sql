-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('WEB_DEVELOPMENT', 'ANDROID_APP', 'IOS_APP', 'AI_SOFTWARE', 'FINTECH_PLATFORM', 'VPS_HOSTING', 'WINDOWS_HOSTING', 'SOCIAL_MEDIA', 'DIGITAL_MARKETING', 'SEO', 'LEAD_GENERATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('QUOTE_ONLY', 'FROM', 'FIXED', 'TIERED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'QUOTE_ONLY',
    "icon" TEXT,
    "coverImageUrl" TEXT,
    "accentColor" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startingPrice" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "priceSuffix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plans" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "specs" JSONB,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "renewalPrice" DECIMAL(18,2),
    "compareAtPrice" DECIMAL(18,2),
    "setupFee" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',

    CONSTRAINT "service_plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "planId" TEXT,
    "termMonths" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "budget" TEXT,
    "timeline" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'public',
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "internalNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_userId_category_idx" ON "services"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "services_userId_slug_key" ON "services"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_plans_serviceId_slug_key" ON "service_plans"("serviceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_plan_prices_planId_termMonths_key" ON "service_plan_prices"("planId", "termMonths");

-- CreateIndex
CREATE INDEX "quote_requests_userId_status_createdAt_idx" ON "quote_requests"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plan_prices" ADD CONSTRAINT "service_plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "service_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

