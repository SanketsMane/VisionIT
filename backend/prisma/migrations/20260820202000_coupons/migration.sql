-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'CATEGORY', 'SERVICE');

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(18,2),
ADD COLUMN     "quotedPrice" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DECIMAL(18,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(18,2),
    "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
    "categories" "ServiceCategory"[] DEFAULT ARRAY[]::"ServiceCategory"[],
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minTermMonths" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_userId_isActive_idx" ON "coupons"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_userId_code_key" ON "coupons"("userId", "code");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

