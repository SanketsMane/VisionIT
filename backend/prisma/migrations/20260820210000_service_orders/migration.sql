-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('QUOTE_REQUESTED', 'QUOTED', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'ACTIVE', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "clientId" TEXT,
    "serviceId" TEXT NOT NULL,
    "planId" TEXT,
    "termMonths" INTEGER,
    "listPrice" DECIMAL(18,2) NOT NULL,
    "couponCode" TEXT,
    "discountAmount" DECIMAL(18,2),
    "customPrice" DECIMAL(18,2),
    "finalPrice" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "requirements" TEXT,
    "deliveryEmail" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "proofKey" TEXT,
    "proofFilename" TEXT,
    "proofMimeType" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "invoiceId" TEXT,
    "credentialsEncrypted" TEXT,
    "deliveryNote" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_messages" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_orders_userId_status_createdAt_idx" ON "service_orders"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "service_orders_clientUserId_createdAt_idx" ON "service_orders"("clientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_userId_orderNumber_key" ON "service_orders"("userId", "orderNumber");

-- CreateIndex
CREATE INDEX "service_order_messages_orderId_createdAt_idx" ON "service_order_messages"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_messages" ADD CONSTRAINT "service_order_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_messages" ADD CONSTRAINT "service_order_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

