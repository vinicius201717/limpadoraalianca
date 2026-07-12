import type { ServiceOrder, UserRole } from "./types";

export function isOwner(role: UserRole) {
  return role === "OWNER";
}

export function isManager(role: UserRole) {
  return role === "GERENTE";
}

export function canCreateManager(role: UserRole) {
  return isOwner(role);
}

export function canManageUsers(role: UserRole) {
  return isOwner(role);
}

export function canManageEmployeeUserAccess(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canActivateEmployeeAccess(role: UserRole) {
  return canManageEmployeeUserAccess(role);
}

export function canCreateEmployee(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canEditEmployee(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canPromoteEmployeeToSupervisor(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canPromoteSupervisorToManager(role: UserRole) {
  return role === "OWNER";
}

export function canPromoteToSupervisor(role: UserRole) {
  return canPromoteEmployeeToSupervisor(role);
}

export function canAssignSupervisorToServiceOrder(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canAssignSupervisor(role: UserRole) {
  return canAssignSupervisorToServiceOrder(role);
}

export function canManageServiceOrderTeam(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canUpdateServiceOrderStatus(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canAccessAllServiceOrders(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canViewAllServiceOrders(role: UserRole) {
  return canAccessAllServiceOrders(role);
}

export function canAccessAssignedServiceOrder(role: UserRole) {
  return role === "SUPERVISOR_OBRA" || role === "COLABORADOR";
}

export function canViewAssignedServiceOrders(role: UserRole) {
  return canAccessAssignedServiceOrder(role);
}

export function canViewWarehouseServiceOrders(role: UserRole) {
  return role === "ALMOXARIFADO";
}

export function canViewFinancialServiceOrders(role: UserRole) {
  return role === "FINANCEIRO";
}

export function canManageStock(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "ALMOXARIFADO";
}

export function canPrepareServiceMaterials(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "ALMOXARIFADO";
}

export function canRequestServiceMaterials(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA" || role === "ALMOXARIFADO";
}

export function canCompleteChecklistItem(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canCreateChecklist(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canEditChecklist(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canOperateChecklist(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canValidateChecklistItem(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canReopenChecklistItem(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canViewOwnChecklistTasks(role: UserRole) {
  return role === "COLABORADOR";
}

export function canManageChecklistTemplates(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canEvaluateEmployees(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}

export function canEvaluateEmployee(role: UserRole) {
  return canEvaluateEmployees(role);
}

export function canEvaluateSupervisor(role: UserRole) {
  return role === "COLABORADOR";
}

export function canAccessFinance(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "FINANCEIRO";
}

export function canViewServiceOrderFinancials(role: UserRole) {
  return role === "OWNER" || role === "FINANCEIRO";
}

export function canManageSettings(role: UserRole) {
  return role === "OWNER";
}

export function canAccessOperationalReports(role: UserRole) {
  return role === "OWNER" || role === "GERENTE";
}

export function canViewCustomers(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL" || role === "TECNICO" || role === "FINANCEIRO";
}

export function canCreateCustomer(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
}

export function canEditCustomer(role: UserRole) {
  return canCreateCustomer(role);
}

export function canViewLeads(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
}

export function canCreateLead(role: UserRole) {
  return canViewLeads(role);
}

export function canEditLead(role: UserRole) {
  return canViewLeads(role);
}

export function canConvertLead(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
}

export function canViewInspections(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL" || role === "TECNICO";
}

export function canCreateInspection(role: UserRole) {
  return canViewInspections(role);
}

export function canEditInspection(role: UserRole) {
  return canViewInspections(role);
}

export function canCompleteInspection(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "TECNICO";
}

export function canViewQuotes(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL" || role === "FINANCEIRO";
}

export function canCreateQuote(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
}

export function canEditQuote(role: UserRole) {
  return canCreateQuote(role);
}

export function canApproveQuote(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
}

export function canSendQuote(role: UserRole) {
  return canCreateQuote(role);
}

export function canManageTargetUserRole(actorRole: UserRole, targetRole: UserRole, nextRole: UserRole) {
  if (targetRole === "OWNER") return false;
  if (nextRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole !== "GERENTE") return false;
  if (targetRole === "GERENTE") return false;
  return nextRole === "COLABORADOR" || nextRole === "SUPERVISOR_OBRA";
}

export function canActivateTargetUser(actorRole: UserRole, targetRole: UserRole) {
  if (targetRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "GERENTE") return targetRole === "COLABORADOR" || targetRole === "SUPERVISOR_OBRA";
  return false;
}

export function canCreateUserWithRole(actorRole: UserRole, nextRole: UserRole) {
  if (nextRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "GERENTE") return nextRole === "COLABORADOR" || nextRole === "SUPERVISOR_OBRA";
  return false;
}

export function canAccessStock(role: UserRole) {
  return canManageStock(role);
}

export function canAccessServiceOrderByAssignment(
  role: UserRole,
  userId: string,
  order: ServiceOrder,
  linkedEmployeeId?: string,
) {
  if (canAccessAllServiceOrders(role)) return true;
  if (role === "SUPERVISOR_OBRA") {
    return Boolean(linkedEmployeeId && order.supervisorEmployeeId === linkedEmployeeId) || order.supervisorUserId === userId;
  }
  if (role === "COLABORADOR") {
    return Boolean(linkedEmployeeId && order.employeeIds.includes(linkedEmployeeId));
  }
  return false;
}
