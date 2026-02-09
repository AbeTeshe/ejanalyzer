-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerTin` VARCHAR(191) NOT NULL,
    `mrc` VARCHAR(191) NOT NULL,
    `fsNo` VARCHAR(191) NOT NULL,
    `buyerTin` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL,
    `lineTotal` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
