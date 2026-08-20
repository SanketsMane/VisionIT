-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('CLIENT_OWNER', 'CLIENT_MANAGER', 'TESTER', 'VIEWER', 'INTERNAL_MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProjectDeliveryStatus" AS ENUM ('NOT_STARTED', 'PREPARING', 'READY_FOR_CLIENT', 'CLIENT_REVIEWING', 'OWNERSHIP_TRANSFER', 'DELIVERED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SourceCodeMethod" AS ENUM ('NOT_CHOSEN', 'GITHUB', 'ZIP');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('NOT_STARTED', 'CLIENT_DETAILS_SUBMITTED', 'TRANSFER_IN_PROGRESS', 'ADMIN_CONFIRMED', 'CLIENT_CONFIRMED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('COSMETIC', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'READY_FOR_RETEST', 'RETESTED', 'CLOSED', 'REJECTED', 'DUPLICATE', 'CANNOT_REPRODUCE', 'DEFERRED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PROPOSAL', 'AGREEMENT', 'SOW', 'REQUIREMENTS', 'DESIGN', 'TECHNICAL_DOC', 'USER_DOC', 'TESTING_REPORT', 'DEPLOYMENT_DOC', 'CREDENTIALS', 'FINAL_REPORT', 'INVOICE', 'RECEIPT', 'BUILD', 'SOURCE_CODE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('ADMIN_ONLY', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "code" TEXT,
ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'INTERNAL';

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_invitations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "ProjectRole" NOT NULL DEFAULT 'CLIENT_OWNER',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "proofKey" TEXT,
    "proofFilename" TEXT,
    "proofMimeType" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bugs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedBehavior" TEXT,
    "actualBehavior" TEXT,
    "stepsToReproduce" TEXT,
    "priority" "BugPriority" NOT NULL DEFAULT 'MEDIUM',
    "severity" "BugSeverity" NOT NULL DEFAULT 'MAJOR',
    "status" "BugStatus" NOT NULL DEFAULT 'SUBMITTED',
    "module" TEXT,
    "environment" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "os" TEXT,
    "url" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "duplicateOfId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_comments" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_attachments" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_activities" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "version" TEXT,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_downloads" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deliveries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ProjectDeliveryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "version" TEXT,
    "sourceCodeMethod" "SourceCodeMethod" NOT NULL DEFAULT 'NOT_CHOSEN',
    "githubRepoUrl" TEXT,
    "githubOwner" TEXT,
    "githubUsername" TEXT,
    "handoverStatus" "HandoverStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "transferNotes" TEXT,
    "transferredAt" TIMESTAMP(3),
    "zipStorageKey" TEXT,
    "zipFilename" TEXT,
    "zipSizeBytes" INTEGER,
    "zipChecksum" TEXT,
    "zipVersion" TEXT,
    "zipDownloadCount" INTEGER NOT NULL DEFAULT 0,
    "releaseNotes" TEXT,
    "adminConfirmedAt" TIMESTAMP(3),
    "adminConfirmedById" TEXT,
    "clientConfirmedAt" TIMESTAMP(3),
    "clientConfirmedById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_checklist_items" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT,

    CONSTRAINT "delivery_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_versions" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "sourceMethod" "SourceCodeMethod" NOT NULL DEFAULT 'NOT_CHOSEN',
    "storageKey" TEXT,
    "filename" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "githubUrl" TEXT,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "event" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_projectId_role_idx" ON "project_members"("projectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_invitations_tokenHash_key" ON "project_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "project_invitations_projectId_status_idx" ON "project_invitations"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_invitations_email_idx" ON "project_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_paymentId_key" ON "payment_requests"("paymentId");

-- CreateIndex
CREATE INDEX "payment_requests_projectId_status_idx" ON "payment_requests"("projectId", "status");

-- CreateIndex
CREATE INDEX "payment_requests_status_createdAt_idx" ON "payment_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "bugs_projectId_status_idx" ON "bugs"("projectId", "status");

-- CreateIndex
CREATE INDEX "bugs_projectId_priority_idx" ON "bugs"("projectId", "priority");

-- CreateIndex
CREATE INDEX "bugs_projectId_severity_idx" ON "bugs"("projectId", "severity");

-- CreateIndex
CREATE INDEX "bugs_assignedToUserId_idx" ON "bugs"("assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "bugs_projectId_number_key" ON "bugs"("projectId", "number");

-- CreateIndex
CREATE INDEX "bug_comments_bugId_isInternal_idx" ON "bug_comments"("bugId", "isInternal");

-- CreateIndex
CREATE INDEX "bug_attachments_bugId_idx" ON "bug_attachments"("bugId");

-- CreateIndex
CREATE INDEX "bug_activities_bugId_createdAt_idx" ON "bug_activities"("bugId", "createdAt");

-- CreateIndex
CREATE INDEX "project_documents_projectId_visibility_idx" ON "project_documents"("projectId", "visibility");

-- CreateIndex
CREATE INDEX "project_documents_projectId_category_idx" ON "project_documents"("projectId", "category");

-- CreateIndex
CREATE INDEX "document_downloads_documentId_idx" ON "document_downloads"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "project_deliveries_projectId_key" ON "project_deliveries"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_checklist_items_deliveryId_key_key" ON "delivery_checklist_items"("deliveryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_versions_deliveryId_version_key" ON "delivery_versions"("deliveryId", "version");

-- CreateIndex
CREATE INDEX "announcements_projectId_publishedAt_idx" ON "announcements"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "project_activities_projectId_createdAt_idx" ON "project_activities"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_activities_entityType_entityId_idx" ON "project_activities"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "email_logs_projectId_createdAt_idx" ON "email_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_event_status_idx" ON "email_logs"("event", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_userId_code_key" ON "projects"("userId", "code");

-- CreateIndex
CREATE INDEX "users_ownerId_userType_idx" ON "users"("ownerId", "userType");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "bugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_activities" ADD CONSTRAINT "bug_activities_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_activities" ADD CONSTRAINT "bug_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "project_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_adminConfirmedById_fkey" FOREIGN KEY ("adminConfirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_clientConfirmedById_fkey" FOREIGN KEY ("clientConfirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_checklist_items" ADD CONSTRAINT "delivery_checklist_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "project_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_checklist_items" ADD CONSTRAINT "delivery_checklist_items_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_versions" ADD CONSTRAINT "delivery_versions_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "project_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_versions" ADD CONSTRAINT "delivery_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

