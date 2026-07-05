-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "description" TEXT,
    "customerReference" TEXT,
    "status" TEXT NOT NULL,
    "fiberInvoice" TEXT,
    "paymentHash" TEXT,
    "receiptId" TEXT,
    "expiresAt" DATETIME,
    "metadataJson" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentIntent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "orderId" TEXT,
    "eventType" TEXT NOT NULL,
    "asset" TEXT,
    "amount" TEXT,
    "paymentHash" TEXT,
    "dataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "lastError" TEXT,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "paymentHash" TEXT,
    "status" TEXT NOT NULL,
    "html" TEXT,
    "json" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PaymentIntent_merchantId_createdAt_idx" ON "PaymentIntent"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_merchantId_orderId_key" ON "PaymentIntent"("merchantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_merchantId_idempotencyKey_key" ON "PaymentIntent"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEvent_merchantId_createdAt_idx" ON "LedgerEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEvent_paymentIntentId_idx" ON "LedgerEvent"("paymentIntentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextRetryAt_idx" ON "WebhookEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_createdAt_idx" ON "WebhookEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentIntentId_idx" ON "WebhookEvent"("paymentIntentId");

-- CreateIndex
CREATE INDEX "Receipt_merchantId_createdAt_idx" ON "Receipt"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentIntentId_key" ON "Receipt"("paymentIntentId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_merchantId_idx" ON "IdempotencyRecord"("merchantId");
