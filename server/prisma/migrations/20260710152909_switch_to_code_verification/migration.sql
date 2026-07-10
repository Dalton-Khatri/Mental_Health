/*
  Warnings:

  - You are about to drop the column `verifyToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "verifyToken",
ADD COLUMN     "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifyCode" TEXT,
ADD COLUMN     "verifyCodeExpiry" TIMESTAMP(3);
