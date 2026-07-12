import {
  customers,
  employees,
  equipment,
  evaluations,
  inspections,
  leads,
  materials,
  quotes,
  serviceOrders,
  users,
} from "./demo-data";

export type ColumnFormat = "currency" | "date" | "datetime" | "status" | "rating" | "number";

export type ModuleColumn = {
  key: string;
  label: string;
  format?: ColumnFormat;
};

export type ModuleConfig = {
  key: string;
  title: string;
  subtitle: string;
  newPath?: string;
  detailBasePath?: string;
  searchPlaceholder: string;
  columns: ModuleColumn[];
  rows: Array<Record<string, unknown>>;
  filters?: Array<{ key: string; label: string; options: string[] }>;
  emptyTitle: string;
};

const financeRows = serviceOrders.map((order) => ({
  id: order.id,
  title: order.title,
  customerName: order.customerName,
  revenue: order.revenue,
  expenses: order.expenses,
  profit: order.revenue - order.expenses,
  margin: Math.round(((order.revenue - order.expenses) / order.revenue) * 100),
}));

const galleryRows = serviceOrders.map((order, index) => ({
  id: `photo-${order.id}`,
  title: order.title,
  customerName: order.customerName,
  stage: ["Antes", "Durante", "Depois"][index % 3],
  photos: 12 + index * 4,
  status: order.status,
}));

const warrantyRows = serviceOrders.map((order, index) => ({
  id: `war-${order.id}`,
  title: order.title,
  customerName: order.customerName,
  startsAt: "2026-07-01",
  endsAt: `2027-0${index + 1}-15`,
  status: index === 2 ? "Expira em breve" : "Ativa",
}));

const reportRows = [
  { id: "rep-001", title: "Faturamento por mes", owner: "Financeiro", updatedAt: "2026-07-01", status: "Atualizado" },
  { id: "rep-002", title: "Qualidade por colaborador", owner: "Gerencia", updatedAt: "2026-06-30", status: "Atualizado" },
  { id: "rep-003", title: "Servicos por origem", owner: "Comercial", updatedAt: "2026-06-28", status: "Revisar" },
];

const settingsRows = [
  { id: "cfg-001", title: "Usuarios e permissoes", owner: "OWNER", status: "Restrito", updatedAt: "2026-07-01" },
  { id: "cfg-002", title: "Tipos de servico", owner: "GERENTE", status: "Ativo", updatedAt: "2026-06-29" },
  { id: "cfg-003", title: "Checklists padrao", owner: "SUPERVISOR_OBRA", status: "Ativo", updatedAt: "2026-06-27" },
];

export const moduleConfigs: Record<string, ModuleConfig> = {
  usuarios: {
    key: "usuarios",
    title: "Usuarios",
    subtitle: "Acessos ao sistema, papeis e vinculo opcional com colaboradores operacionais.",
    newPath: "/usuarios/novo",
    detailBasePath: "/usuarios",
    searchPlaceholder: "Buscar usuario, e-mail ou perfil",
    rows: users.map((user) => ({
      ...user,
      linkedEmployee: employees.find((employee) => employee.userId === user.id)?.name ?? "Sem vinculo",
    })) as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "name", label: "Usuario" },
      { key: "email", label: "E-mail" },
      { key: "role", label: "Perfil", format: "status" },
      { key: "isActive", label: "Ativo", format: "status" },
      { key: "linkedEmployee", label: "Colaborador vinculado" },
    ],
    filters: [{ key: "role", label: "Perfil", options: ["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "FINANCEIRO", "COLABORADOR"] }],
    emptyTitle: "Nenhum usuario encontrado",
  },
  supervisores: {
    key: "supervisores",
    title: "Supervisores",
    subtitle: "Supervisores de obra, ordens designadas e media recebida da equipe.",
    detailBasePath: "/colaboradores",
    searchPlaceholder: "Buscar supervisor ou obra",
    rows: employees
      .filter((employee) => employee.userId && users.some((user) => user.id === employee.userId && user.role === "SUPERVISOR_OBRA"))
      .map((employee) => ({
        ...employee,
        assignedOrders: serviceOrders.filter((order) => order.supervisorEmployeeId === employee.id).length,
        supervisorAverageRating: employee.supervisorAverageRating ?? employee.averageRating,
      })) as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "name", label: "Supervisor" },
      { key: "specialty", label: "Especialidade", format: "status" },
      { key: "assignedOrders", label: "OS designadas", format: "number" },
      { key: "supervisorAverageRating", label: "Media supervisor", format: "rating" },
      { key: "status", label: "Status", format: "status" },
    ],
    emptyTitle: "Nenhum supervisor encontrado",
  },
  clientes: {
    key: "clientes",
    title: "Clientes",
    subtitle: "Carteira ativa, historico de servicos e origem dos relacionamentos.",
    newPath: "/clientes/novo",
    detailBasePath: "/clientes",
    searchPlaceholder: "Buscar cliente, telefone ou origem",
    rows: customers as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "name", label: "Cliente" },
      { key: "type", label: "Tipo", format: "status" },
      { key: "phone", label: "Telefone" },
      { key: "totalValue", label: "Valor acumulado", format: "currency" },
      { key: "lastService", label: "Ultimo servico" },
    ],
    filters: [{ key: "type", label: "Tipo", options: ["CONDOMINIUM", "PERSON", "ARCHITECT", "CONSTRUCTION_COMPANY", "COMPANY"] }],
    emptyTitle: "Nenhum cliente encontrado",
  },
  leads: {
    key: "leads",
    title: "Leads",
    subtitle: "Funil comercial com proximos contatos e potencial de receita.",
    newPath: "/leads/novo",
    detailBasePath: "/leads",
    searchPlaceholder: "Buscar lead, origem ou status",
    rows: leads as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "name", label: "Lead" },
      { key: "status", label: "Status", format: "status" },
      { key: "estimatedValue", label: "Valor estimado", format: "currency" },
      { key: "nextFollowUpAt", label: "Proximo follow-up", format: "date" },
      { key: "source", label: "Origem" },
    ],
    filters: [{ key: "status", label: "Status", options: ["NEW", "CONTACTED", "INSPECTION_SCHEDULED", "QUOTE_SENT", "NEGOTIATION"] }],
    emptyTitle: "Nenhum lead encontrado",
  },
  vistorias: {
    key: "vistorias",
    title: "Vistorias",
    subtitle: "Analise tecnica, superficie, risco e recomendacao de servico.",
    newPath: "/vistorias/nova",
    detailBasePath: "/vistorias",
    searchPlaceholder: "Buscar cliente, superficie ou servico",
    rows: inspections as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "customerName", label: "Cliente" },
      { key: "surfaceType", label: "Superficie", format: "status" },
      { key: "serviceType", label: "Servico", format: "status" },
      { key: "areaM2", label: "Area m2", format: "number" },
      { key: "technicalRisk", label: "Risco", format: "status" },
    ],
    filters: [{ key: "technicalRisk", label: "Risco", options: ["Baixo", "Medio"] }],
    emptyTitle: "Nenhuma vistoria encontrada",
  },
  orcamentos: {
    key: "orcamentos",
    title: "Orcamentos",
    subtitle: "Propostas, validade, condicoes de pagamento e aprovacao para OS.",
    newPath: "/orcamentos/novo",
    detailBasePath: "/orcamentos",
    searchPlaceholder: "Buscar cliente ou status",
    rows: quotes as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "customerName", label: "Cliente" },
      { key: "status", label: "Status", format: "status" },
      { key: "validUntil", label: "Validade", format: "date" },
      { key: "total", label: "Total", format: "currency" },
      { key: "paymentTerms", label: "Condicoes" },
    ],
    filters: [{ key: "status", label: "Status", options: ["DRAFT", "SENT", "APPROVED"] }],
    emptyTitle: "Nenhum orcamento encontrado",
  },
  "ordens-servico": {
    key: "ordens-servico",
    title: "Ordens de servico",
    subtitle: "Planejamento operacional, equipe, checklist, financeiro e entrega.",
    detailBasePath: "/ordens-servico",
    searchPlaceholder: "Buscar OS, cliente, endereco ou status",
    rows: serviceOrders as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "title", label: "Servico" },
      { key: "customerName", label: "Cliente" },
      { key: "status", label: "Status", format: "status" },
      { key: "scheduledStart", label: "Inicio", format: "datetime" },
      { key: "revenue", label: "Receita", format: "currency" },
    ],
    filters: [{ key: "status", label: "Status", options: ["SCHEDULED", "PREPARING", "IN_PROGRESS", "DONE"] }],
    emptyTitle: "Nenhuma OS encontrada",
  },
  avaliacoes: {
    key: "avaliacoes",
    title: "Avaliacoes",
    subtitle: "Qualidade por obra, criterios de desempenho e necessidades de treinamento.",
    detailBasePath: "/avaliacoes",
    searchPlaceholder: "Buscar colaborador, supervisor ou observacao",
    rows: evaluations as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "employeeName", label: "Colaborador" },
      { key: "supervisorName", label: "Supervisor" },
      { key: "overallScore", label: "Media", format: "rating" },
      { key: "needsTraining", label: "Treinamento", format: "status" },
      { key: "createdAt", label: "Data", format: "date" },
    ],
    filters: [{ key: "needsTraining", label: "Treinamento", options: ["true", "false"] }],
    emptyTitle: "Nenhuma avaliacao encontrada",
  },
  materiais: {
    key: "materiais",
    title: "Materiais",
    subtitle: "Estoque, custo medio e alerta de reposicao para compras.",
    rows: materials as unknown as Array<Record<string, unknown>>,
    searchPlaceholder: "Buscar material",
    columns: [
      { key: "name", label: "Material" },
      { key: "currentStock", label: "Estoque", format: "number" },
      { key: "minStock", label: "Minimo", format: "number" },
      { key: "unit", label: "Unidade" },
      { key: "unitCost", label: "Custo", format: "currency" },
    ],
    emptyTitle: "Nenhum material encontrado",
  },
  equipamentos: {
    key: "equipamentos",
    title: "Equipamentos",
    subtitle: "Uso, disponibilidade, manutencao e alocacao por obra.",
    rows: equipment as unknown as Array<Record<string, unknown>>,
    searchPlaceholder: "Buscar equipamento",
    columns: [
      { key: "name", label: "Equipamento" },
      { key: "code", label: "Codigo" },
      { key: "status", label: "Status", format: "status" },
      { key: "notes", label: "Notas" },
    ],
    filters: [{ key: "status", label: "Status", options: ["Disponivel", "Em obra", "Manutencao"] }],
    emptyTitle: "Nenhum equipamento encontrado",
  },
  financeiro: {
    key: "financeiro",
    title: "Financeiro",
    subtitle: "Receita, despesas e margem por ordem de servico.",
    rows: financeRows,
    searchPlaceholder: "Buscar OS ou cliente",
    columns: [
      { key: "title", label: "OS" },
      { key: "customerName", label: "Cliente" },
      { key: "revenue", label: "Receita", format: "currency" },
      { key: "expenses", label: "Despesas", format: "currency" },
      { key: "profit", label: "Lucro", format: "currency" },
      { key: "margin", label: "Margem %", format: "number" },
    ],
    emptyTitle: "Nenhum lancamento encontrado",
  },
  galeria: {
    key: "galeria",
    title: "Galeria",
    subtitle: "Fotos de antes, durante e depois organizadas por obra.",
    rows: galleryRows,
    searchPlaceholder: "Buscar galeria por obra ou cliente",
    columns: [
      { key: "title", label: "Obra" },
      { key: "customerName", label: "Cliente" },
      { key: "stage", label: "Etapa", format: "status" },
      { key: "photos", label: "Fotos", format: "number" },
      { key: "status", label: "Status OS", format: "status" },
    ],
    filters: [{ key: "stage", label: "Etapa", options: ["Antes", "Durante", "Depois"] }],
    emptyTitle: "Nenhuma foto encontrada",
  },
  garantias: {
    key: "garantias",
    title: "Garantias",
    subtitle: "Prazos, termos e acompanhamento de pos-venda.",
    rows: warrantyRows,
    searchPlaceholder: "Buscar garantia",
    columns: [
      { key: "title", label: "Servico" },
      { key: "customerName", label: "Cliente" },
      { key: "startsAt", label: "Inicio", format: "date" },
      { key: "endsAt", label: "Fim", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    emptyTitle: "Nenhuma garantia encontrada",
  },
  relatorios: {
    key: "relatorios",
    title: "Relatorios",
    subtitle: "Indicadores operacionais, financeiros e de qualidade.",
    rows: reportRows,
    searchPlaceholder: "Buscar relatorio",
    columns: [
      { key: "title", label: "Relatorio" },
      { key: "owner", label: "Area" },
      { key: "updatedAt", label: "Atualizado", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    emptyTitle: "Nenhum relatorio encontrado",
  },
  configuracoes: {
    key: "configuracoes",
    title: "Configuracoes",
    subtitle: "Usuarios, permissoes, servicos e checklists padrao.",
    rows: settingsRows,
    searchPlaceholder: "Buscar configuracao",
    columns: [
      { key: "title", label: "Configuracao" },
      { key: "owner", label: "Perfil" },
      { key: "status", label: "Status", format: "status" },
      { key: "updatedAt", label: "Atualizado", format: "date" },
    ],
    emptyTitle: "Nenhuma configuracao encontrada",
  },
  agenda: {
    key: "agenda",
    title: "Agenda",
    subtitle: "Calendario operacional com equipes, janelas e proximos marcos.",
    rows: serviceOrders.map((order) => ({
      id: order.id,
      title: order.title,
      customerName: order.customerName,
      scheduledStart: order.scheduledStart,
      scheduledEnd: order.scheduledEnd,
      status: order.status,
      address: order.address,
    })),
    searchPlaceholder: "Buscar agenda",
    columns: [
      { key: "title", label: "Servico" },
      { key: "customerName", label: "Cliente" },
      { key: "scheduledStart", label: "Inicio", format: "datetime" },
      { key: "scheduledEnd", label: "Fim", format: "datetime" },
      { key: "status", label: "Status", format: "status" },
    ],
    emptyTitle: "Nenhum item de agenda encontrado",
  },
  colaboradores: {
    key: "colaboradores",
    title: "Colaboradores",
    subtitle: "Equipe operacional, desempenho, especialidade e historico por obra.",
    newPath: "/colaboradores/novo",
    detailBasePath: "/colaboradores",
    searchPlaceholder: "Buscar colaborador, funcao ou especialidade",
    rows: employees as unknown as Array<Record<string, unknown>>,
    columns: [
      { key: "name", label: "Colaborador" },
      { key: "specialty", label: "Especialidade", format: "status" },
      { key: "status", label: "Status", format: "status" },
      { key: "averageRating", label: "Media", format: "rating" },
      { key: "serviceOrdersCount", label: "Obras", format: "number" },
      { key: "lastJob", label: "Ultima obra" },
    ],
    filters: [
      { key: "status", label: "Status", options: ["ACTIVE", "INACTIVE", "ON_LEAVE", "FIRED"] },
      { key: "specialty", label: "Especialidade", options: ["Polimento", "Limpeza pos-obra", "Supervisor", "Impermeabilizacao"] },
    ],
    emptyTitle: "Nenhum colaborador encontrado",
  },
};

export function getModuleConfig(key: string) {
  return moduleConfigs[key];
}
