/*
  Warnings:

  - Added the required column `status` to the `movements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."LedgerStatus" ADD VALUE 'APPROVED';
ALTER TYPE "public"."LedgerStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "public"."movements" ADD COLUMN "status" "public"."LedgerStatus" NOT NULL;

-- CreateIndex
CREATE INDEX "movements_status_idx" ON "public"."movements"("status");
