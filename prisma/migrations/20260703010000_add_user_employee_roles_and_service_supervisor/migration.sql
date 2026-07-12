-- Add user/session fields.
ALTER TABLE `User` ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- Keep roleName for compatibility and add the official jobTitle field.
ALTER TABLE `Employee` ADD COLUMN `jobTitle` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Employee_document_key` ON `Employee`(`document`);

-- Preserve old supervisor fields while adding the official assignment audit fields.
ALTER TABLE `ServiceOrder` ADD COLUMN `assignedSupervisorByUserId` VARCHAR(191) NULL;
ALTER TABLE `ServiceOrder` ADD COLUMN `supervisorAssignedAt` DATETIME(3) NULL;

-- Audit metadata requested for security traceability.
ALTER TABLE `AuditLog` ADD COLUMN `ipAddress` VARCHAR(191) NULL;
