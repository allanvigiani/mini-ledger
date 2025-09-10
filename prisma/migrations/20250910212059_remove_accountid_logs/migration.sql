/*
  Warnings:

  - You are about to drop the column `accountId` on the `ledger_log` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ledger_log" DROP CONSTRAINT "ledger_log_accountId_fkey";

-- AlterTable
ALTER TABLE "public"."ledger_log" DROP COLUMN "accountId";
