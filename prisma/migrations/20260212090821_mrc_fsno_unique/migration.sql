/*
  Warnings:

  - You are about to drop the column `lineTotal` on the `transactions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mrc,fsNo]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `grandTotal` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `transactions` DROP COLUMN `lineTotal`,
    ADD COLUMN `grandTotal` DOUBLE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `transactions_mrc_fsNo_key` ON `transactions`(`mrc`, `fsNo`);
