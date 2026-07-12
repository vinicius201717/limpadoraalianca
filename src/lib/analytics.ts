import { employees, evaluations, leads, materials, quotes, serviceOrders } from "./demo-data";
import { formatCurrency } from "./format";
import { labelFor } from "./labels";
import type { AttentionItem, ChartPoint, DashboardData, DashboardMetric, PerformanceScores, ServiceOrderStatus } from "./types";

const today = new Date("2026-07-02T12:00:00");
const activeOrderStatuses: ServiceOrderStatus[] = ["IN_PROGRESS", "PREPARING", "WAITING_CUSTOMER"];
const finishedOrderStatuses: ServiceOrderStatus[] = ["DONE", "DELIVERED"];

function isSameMonth(value: string) {
  const date = new Date(value);
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function getAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(value: string) {
  const date = new Date(value);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getOrderHasPendingEvaluation(orderId: string, employeeIds: string[], sourceEvaluations = evaluations) {
  return employeeIds.some(
    (employeeId) => !sourceEvaluations.some((evaluation) => evaluation.serviceOrderId === orderId && evaluation.employeeId === employeeId),
  );
}

function countQuotesWaitingResponse(sourceQuotes = quotes) {
  return sourceQuotes.filter((quote) => quote.status === "SENT" || quote.status === "DRAFT").length;
}

function getServiceStatusChart(sourceServiceOrders = serviceOrders): ChartPoint[] {
  const rows: Array<{ label: string; statuses: ServiceOrderStatus[] }> = [
    { label: "Agendado", statuses: ["SCHEDULED"] },
    { label: "Preparando", statuses: ["PREPARING"] },
    { label: "Execucao", statuses: ["IN_PROGRESS", "WAITING_CUSTOMER", "PAUSED"] },
    { label: "Finalizado", statuses: ["DONE", "DELIVERED"] },
  ];

  return rows.map((row) => ({
    label: row.label,
    value: sourceServiceOrders.filter((order) => row.statuses.includes(order.status)).length,
  }));
}

function scoresToCriteriaChart(scores: Array<PerformanceScores>): ChartPoint[] {
  return [
    { label: "Pontualidade", value: getAverage(scores.map((score) => score.punctuality)) },
    { label: "Qualidade tecnica", value: getAverage(scores.map((score) => score.quality)) },
    { label: "Produtividade", value: getAverage(scores.map((score) => score.productivity)) },
    { label: "Cuidado com imovel", value: getAverage(scores.map((score) => score.care)) },
    { label: "Trabalho em equipe", value: getAverage(scores.map((score) => score.teamwork)) },
    { label: "Postura com cliente", value: getAverage(scores.map((score) => score.clientPosture)) },
    { label: "Checklist", value: getAverage(scores.map((score) => score.checklistCompliance)) },
  ].map((item) => ({ ...item, value: Number(item.value.toFixed(1)) }));
}

function getCriteriaAverageRatings(sourceEvaluations = evaluations, sourceEmployees = employees): ChartPoint[] {
  if (sourceEvaluations.length > 0) {
    return scoresToCriteriaChart(
      sourceEvaluations.map((evaluation) => ({
        punctuality: evaluation.punctualityScore,
        quality: evaluation.qualityScore,
        productivity: evaluation.productivityScore,
        care: evaluation.careScore,
        teamwork: evaluation.teamworkScore,
        clientPosture: evaluation.clientPostureScore,
        checklistCompliance: evaluation.checklistComplianceScore,
      })),
    );
  }

  const employeeCriteria = sourceEmployees
    .map((employee) => employee.criteriaAverages)
    .filter((score): score is PerformanceScores => Boolean(score));

  return employeeCriteria.length ? scoresToCriteriaChart(employeeCriteria) : [];
}

function getRevenueByMonthChart(sourceServiceOrders = serviceOrders): ChartPoint[] {
  const totalsByMonth = new Map<string, { label: string; timestamp: number; value: number }>();

  sourceServiceOrders
    .filter((order) => order.status !== "CANCELED" && order.revenue > 0)
    .forEach((order) => {
      const dateValue = order.scheduledEnd || order.scheduledStart;
      const monthKey = toMonthKey(dateValue);
      if (!monthKey) return;

      const date = new Date(dateValue);
      const current = totalsByMonth.get(monthKey) ?? {
        label: toMonthLabel(dateValue),
        timestamp: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        value: 0,
      };
      current.value += order.revenue;
      totalsByMonth.set(monthKey, current);
    });

  return Array.from(totalsByMonth.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6)
    .map((item) => ({ label: item.label, value: Number((item.value / 1000).toFixed(1)) }));
}

function getMostExecutedServicesChart(sourceServiceOrders = serviceOrders): ChartPoint[] {
  const totalsByService = new Map<string, number>();

  sourceServiceOrders
    .filter((order) => order.status !== "CANCELED")
    .forEach((order) => {
      const label = labelFor(order.serviceType || "OTHER");
      totalsByService.set(label, (totalsByService.get(label) ?? 0) + 1);
    });

  return Array.from(totalsByService.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 6);
}

export function buildDashboardData(source?: {
  employees?: typeof employees;
  evaluations?: typeof evaluations;
  leads?: typeof leads;
  materials?: typeof materials;
  quotes?: typeof quotes;
  serviceOrders?: typeof serviceOrders;
}): DashboardData {
  const sourceEmployees = source?.employees ?? employees;
  const sourceEvaluations = source?.evaluations ?? evaluations;
  const sourceLeads = source?.leads ?? leads;
  const sourceMaterials = source?.materials ?? materials;
  const sourceQuotes = source?.quotes ?? quotes;
  const sourceServiceOrders = source?.serviceOrders ?? serviceOrders;

  const newLeads = sourceLeads.filter((lead) => lead.status === "NEW");
  const pendingQuotes = sourceQuotes.filter((quote) => quote.status === "SENT" || quote.status === "DRAFT");
  const activeOrders = sourceServiceOrders.filter((order) => activeOrderStatuses.includes(order.status));
  const finishedOrders = sourceServiceOrders.filter((order) => finishedOrderStatuses.includes(order.status));
  const ordersWithoutEvaluation = finishedOrders.filter((order) => getOrderHasPendingEvaluation(order.id, order.employeeIds, sourceEvaluations));
  const activeEmployees = sourceEmployees.filter((employee) => employee.status === "ACTIVE");
  const lowMaterials = sourceMaterials.filter((material) => material.currentStock <= material.minStock);
  const overdueOrders = sourceServiceOrders.filter(
    (order) =>
      !["DONE", "DELIVERED", "CANCELED"].includes(order.status) && new Date(order.scheduledEnd).getTime() < today.getTime(),
  );
  const staleEmployees = activeEmployees.filter((employee) => {
    if (employee.needsTraining) return true;
    if (!employee.lastEvaluationAt) return true;
    const daysWithoutEvaluation = (today.getTime() - new Date(employee.lastEvaluationAt).getTime()) / 86_400_000;
    return daysWithoutEvaluation > 35;
  });
  const monthlyRevenue = sourceServiceOrders
    .filter((order) => isSameMonth(order.scheduledStart) || isSameMonth(order.scheduledEnd))
    .reduce((sum, order) => sum + order.revenue, 0);
  const pendingQuoteValue = pendingQuotes.reduce((sum, quote) => sum + quote.total, 0);
  const averageTeamRating = getAverage(activeEmployees.map((employee) => employee.averageRating));

  const metrics: DashboardMetric[] = [
    {
      label: "Leads novos",
      value: String(newLeads.length),
      trend: `${formatCurrency(newLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0))} em potencial`,
      tone: "primary",
    },
    {
      label: "Orcamentos pendentes",
      value: String(pendingQuotes.length),
      trend: `${formatCurrency(pendingQuoteValue)} aguardando resposta`,
      tone: "warning",
    },
    {
      label: "OS em execucao",
      value: String(activeOrders.length),
      trend: overdueOrders.length > 0 ? `${overdueOrders.length} atrasada` : "Dentro do prazo",
      tone: "info",
    },
    {
      label: "Obras sem avaliacao",
      value: String(ordersWithoutEvaluation.length),
      trend: ordersWithoutEvaluation.length > 0 ? "Acao da supervisao pendente" : "Equipe avaliada",
      tone: ordersWithoutEvaluation.length > 0 ? "error" : "success",
    },
    {
      label: "Media da equipe",
      value: averageTeamRating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
      trend: `${activeEmployees.filter((employee) => employee.averageRating >= 4.8).length} colaboradores em destaque`,
      tone: "success",
    },
    {
      label: "Receita estimada do mes",
      value: formatCurrency(monthlyRevenue),
      trend: "Agenda de julho em andamento",
      tone: "success",
    },
    {
      label: "Servicos finalizados",
      value: String(finishedOrders.length),
      trend: `${ordersWithoutEvaluation.length} pendente de avaliacao`,
      tone: "primary",
    },
    {
      label: "Colaboradores ativos",
      value: String(activeEmployees.length),
      trend: `${staleEmployees.length} exigem acompanhamento`,
      tone: staleEmployees.length > 0 ? "warning" : "success",
    },
  ];

  const attentionItems: AttentionItem[] = [
    {
      title: "Obras atrasadas",
      description: overdueOrders.length
        ? `${overdueOrders.map((order) => order.customerName).join(", ")} precisa de decisao operacional.`
        : "Nenhuma OS fora do prazo neste momento.",
      value: String(overdueOrders.length),
      tone: overdueOrders.length ? "error" : "success",
      href: overdueOrders[0] ? `/ordens-servico/${overdueOrders[0].id}` : "/ordens-servico",
    },
    {
      title: "Orcamentos aguardando resposta",
      description: `${formatCurrency(pendingQuoteValue)} em propostas que ainda podem virar caixa.`,
      value: String(countQuotesWaitingResponse(sourceQuotes)),
      tone: pendingQuotes.length ? "warning" : "success",
      href: "/orcamentos",
    },
    {
      title: "Colaboradores sem avaliacao recente",
      description: staleEmployees.length
        ? `${staleEmployees.map((employee) => employee.name).join(", ")} precisam de acompanhamento.`
        : "Todos os colaboradores ativos foram avaliados recentemente.",
      value: String(staleEmployees.length),
      tone: staleEmployees.length ? "warning" : "success",
      href: "/colaboradores",
    },
    {
      title: "Materiais baixos",
      description: lowMaterials.length
        ? `${lowMaterials.map((material) => material.name).join(", ")} abaixo do minimo.`
        : "Estoque operacional dentro do minimo definido.",
      value: String(lowMaterials.length),
      tone: lowMaterials.length ? "warning" : "success",
      href: "/materiais",
    },
  ];

  return {
    metrics,
    attentionItems,
    revenueByMonth: getRevenueByMonthChart(sourceServiceOrders),
    servicesByStatus: getServiceStatusChart(sourceServiceOrders),
    averageRatings: getCriteriaAverageRatings(sourceEvaluations, sourceEmployees),
    mostExecutedServices: getMostExecutedServicesChart(sourceServiceOrders),
    nextOrders: sourceServiceOrders
      .filter((order) => !finishedOrderStatuses.includes(order.status) && order.status !== "CANCELED")
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
      .slice(0, 4),
    financialOrders: sourceServiceOrders
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    topEmployees: sourceEmployees
      .filter((employee) => employee.status === "ACTIVE")
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 4),
    sourceLabel: "Indicadores calculados da base operacional",
  };
}
