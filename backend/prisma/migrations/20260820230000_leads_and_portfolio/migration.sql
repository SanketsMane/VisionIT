-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FREELANCER', 'GOOGLE', 'SOCIAL_MEDIA', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'LEAD';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "leadCompany" TEXT,
ADD COLUMN     "leadNote" TEXT,
ADD COLUMN     "leadReferrer" TEXT,
ADD COLUMN     "leadSource" "LeadSource",
ADD COLUMN     "leadStatus" "LeadStatus" DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "ProjectCategory" NOT NULL DEFAULT 'WEB_DEVELOPMENT',
    "industry" TEXT,
    "liveUrl" TEXT,
    "coverImage" TEXT,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveredAt" TIMESTAMP(3),
    "clientLabel" TEXT,
    "testimonial" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sourceProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "source" "LeadSource",
    "userId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_items_ownerId_isPublished_sortOrder_idx" ON "portfolio_items"("ownerId", "isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "portfolio_items_ownerId_category_idx" ON "portfolio_items"("ownerId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_ownerId_slug_key" ON "portfolio_items"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "contact_messages_ownerId_isRead_createdAt_idx" ON "contact_messages"("ownerId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

