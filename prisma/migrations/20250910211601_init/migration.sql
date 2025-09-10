-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "public"."LedgerStatus" AS ENUM ('PROCESSED', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "document" VARCHAR(255) NOT NULL,
    "credit_limit" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."movements" (
    "id" SERIAL NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "public"."MovementType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ledger_log" (
    "id" SERIAL NOT NULL,
    "movement_id" INTEGER NOT NULL,
    "status" "public"."LedgerStatus" NOT NULL,
    "fail_reason" TEXT,
    "processed_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,

    CONSTRAINT "ledger_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "public"."accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_document_key" ON "public"."accounts"("document");

-- CreateIndex
CREATE INDEX "movements_account_id_idx" ON "public"."movements"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_log_movement_id_key" ON "public"."ledger_log"("movement_id");

-- CreateIndex
CREATE INDEX "ledger_log_movement_id_idx" ON "public"."ledger_log"("movement_id");

-- CreateIndex
CREATE INDEX "ledger_log_status_idx" ON "public"."ledger_log"("status");

-- AddForeignKey
ALTER TABLE "public"."movements" ADD CONSTRAINT "movements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ledger_log" ADD CONSTRAINT "ledger_log_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ledger_log" ADD CONSTRAINT "ledger_log_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
