-- Expand operational checklist execution without dropping existing checklist data.
ALTER TABLE `ServiceOrderChecklistItem`
  ADD COLUMN `minimumPhotos` INT NOT NULL DEFAULT 0,
  ADD COLUMN `assignedEmployeeId` VARCHAR(191) NULL,
  ADD COLUMN `startedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `startedAt` DATETIME(3) NULL,
  ADD COLUMN `validatedAt` DATETIME(3) NULL,
  ADD COLUMN `completionNotes` TEXT NULL,
  ADD COLUMN `problemDescription` TEXT NULL,
  ADD COLUMN `blockedReason` TEXT NULL,
  ADD COLUMN `createdByUserId` VARCHAR(191) NOT NULL DEFAULT 'usr-owner',
  ADD COLUMN `plannedStartAt` DATETIME(3) NULL,
  ADD COLUMN `dueAt` DATETIME(3) NULL,
  ADD COLUMN `allowCollaboratorAction` BOOLEAN NOT NULL DEFAULT false;

UPDATE `ServiceOrderChecklistItem`
SET `completionNotes` = `notes`
WHERE `completionNotes` IS NULL AND `notes` IS NOT NULL;

CREATE INDEX `ServiceOrderChecklistItem_serviceOrderId_idx` ON `ServiceOrderChecklistItem`(`serviceOrderId`);
CREATE INDEX `ServiceOrderChecklistItem_assignedEmployeeId_idx` ON `ServiceOrderChecklistItem`(`assignedEmployeeId`);
CREATE INDEX `ServiceOrderChecklistItem_status_idx` ON `ServiceOrderChecklistItem`(`status`);

ALTER TABLE `ServiceOrderChecklistItem`
  ADD CONSTRAINT `ServiceOrderChecklistItem_assignedEmployeeId_fkey`
  FOREIGN KEY (`assignedEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceOrderChecklistItem`
  ADD CONSTRAINT `ServiceOrderChecklistItem_completedByEmployeeId_fkey`
  FOREIGN KEY (`completedByEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceOrderChecklistPhoto`
  MODIFY COLUMN `uploadedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `type` ENUM('BEFORE', 'DURING', 'AFTER', 'EVIDENCE', 'PROBLEM') NOT NULL DEFAULT 'EVIDENCE',
  ADD COLUMN `fileName` VARCHAR(191) NULL,
  ADD COLUMN `mimeType` VARCHAR(191) NULL,
  ADD COLUMN `sizeBytes` INT NULL;

UPDATE `ServiceOrderChecklistPhoto`
SET `uploadedByUserId` = 'usr-owner'
WHERE `uploadedByUserId` IS NULL;

ALTER TABLE `ServiceOrderChecklistPhoto`
  MODIFY COLUMN `uploadedByUserId` VARCHAR(191) NOT NULL;

CREATE INDEX `ServiceOrderChecklistPhoto_checklistItemId_idx` ON `ServiceOrderChecklistPhoto`(`checklistItemId`);
CREATE INDEX `ServiceOrderChecklistPhoto_serviceOrderId_idx` ON `ServiceOrderChecklistPhoto`(`serviceOrderId`);

CREATE TABLE `ServiceOrderChecklistEvent` (
  `id` VARCHAR(191) NOT NULL,
  `checklistItemId` VARCHAR(191) NOT NULL,
  `serviceOrderId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NULL,
  `type` ENUM('CREATED', 'UPDATED', 'ASSIGNED', 'STARTED', 'COMPLETED', 'VALIDATED', 'REOPENED', 'BLOCKED', 'CANCELED', 'PHOTO_ADDED', 'PHOTO_REMOVED', 'COMMENT_ADDED') NOT NULL,
  `message` TEXT NULL,
  `previousStatus` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'REOPENED', 'CANCELED') NULL,
  `newStatus` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'REOPENED', 'CANCELED') NULL,
  `metadataJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ServiceOrderChecklistEvent_checklistItemId_idx` ON `ServiceOrderChecklistEvent`(`checklistItemId`);
CREATE INDEX `ServiceOrderChecklistEvent_serviceOrderId_idx` ON `ServiceOrderChecklistEvent`(`serviceOrderId`);
CREATE INDEX `ServiceOrderChecklistEvent_createdAt_idx` ON `ServiceOrderChecklistEvent`(`createdAt`);

ALTER TABLE `ServiceOrderChecklistEvent`
  ADD CONSTRAINT `ServiceOrderChecklistEvent_checklistItemId_fkey`
  FOREIGN KEY (`checklistItemId`) REFERENCES `ServiceOrderChecklistItem`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceOrderChecklistEvent`
  ADD CONSTRAINT `ServiceOrderChecklistEvent_serviceOrderId_fkey`
  FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `ChecklistTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `serviceType` ENUM('POST_CONSTRUCTION_CLEANING', 'POLISHING', 'RESTORATION', 'CRYSTALLIZATION', 'WATERPROOFING', 'STAIN_REMOVAL', 'GROUT_CLEANING', 'MAINTENANCE', 'OTHER') NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChecklistTemplateItem` (
  `id` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isRequired` BOOLEAN NOT NULL DEFAULT true,
  `requiresPhoto` BOOLEAN NOT NULL DEFAULT false,
  `minimumPhotos` INT NOT NULL DEFAULT 0,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ChecklistTemplateItem_templateId_idx` ON `ChecklistTemplateItem`(`templateId`);

ALTER TABLE `ChecklistTemplateItem`
  ADD CONSTRAINT `ChecklistTemplateItem_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `ChecklistTemplate`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
