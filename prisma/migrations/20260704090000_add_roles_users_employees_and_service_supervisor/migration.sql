-- Add explicit relations for service-order supervisor assignment.
CREATE INDEX `ServiceOrder_supervisorEmployeeId_idx` ON `ServiceOrder`(`supervisorEmployeeId`);
CREATE INDEX `ServiceOrder_supervisorUserId_idx` ON `ServiceOrder`(`supervisorUserId`);
CREATE INDEX `ServiceOrder_assignedSupervisorByUserId_idx` ON `ServiceOrder`(`assignedSupervisorByUserId`);

ALTER TABLE `ServiceOrder`
  ADD CONSTRAINT `ServiceOrder_supervisorEmployeeId_fkey`
  FOREIGN KEY (`supervisorEmployeeId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceOrder`
  ADD CONSTRAINT `ServiceOrder_supervisorUserId_fkey`
  FOREIGN KEY (`supervisorUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceOrder`
  ADD CONSTRAINT `ServiceOrder_assignedSupervisorByUserId_fkey`
  FOREIGN KEY (`assignedSupervisorByUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
