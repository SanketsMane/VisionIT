-- AlterEnum
ALTER TYPE "PricingModel" ADD VALUE 'SLAB';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceCategory" ADD VALUE 'TRADING_PLATFORM';
ALTER TYPE "ServiceCategory" ADD VALUE 'ALGO_TRADING';
ALTER TYPE "ServiceCategory" ADD VALUE 'AI_AGENT';
ALTER TYPE "ServiceCategory" ADD VALUE 'AUTOMATION';
ALTER TYPE "ServiceCategory" ADD VALUE 'MEDIA_GENERATION';
ALTER TYPE "ServiceCategory" ADD VALUE 'SMS_SERVICE';

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "unitPrice" DECIMAL(18,4),
ADD COLUMN     "validityLabel" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "minOrderAmount" DECIMAL(18,2),
ADD COLUMN     "priceNote" TEXT,
ADD COLUMN     "unitLabel" TEXT;

-- CreateTable
CREATE TABLE "service_price_slabs" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "minAmount" DECIMAL(18,2) NOT NULL,
    "maxAmount" DECIMAL(18,2),
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "validityLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_price_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_price_slabs_serviceId_minAmount_idx" ON "service_price_slabs"("serviceId", "minAmount");

-- AddForeignKey
ALTER TABLE "service_price_slabs" ADD CONSTRAINT "service_price_slabs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

