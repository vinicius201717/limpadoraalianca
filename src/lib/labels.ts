const labels: Record<string, string> = {
  ALL: "Todos",

  OWNER: "Dono",
  GERENTE: "Gerente",
  SUPERVISOR_OBRA: "Supervisor de obra",
  ALMOXARIFADO: "Almoxarifado",
  COMERCIAL: "Comercial",
  TECNICO: "Tecnico",
  FINANCEIRO: "Financeiro",
  COLABORADOR: "Colaborador",

  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ON_LEAVE: "Afastado",
  FIRED: "Desligado",

  NEW: "Novo",
  CONTACTED: "Contato feito",
  INSPECTION_SCHEDULED: "Vistoria agendada",
  INSPECTION_DONE: "Vistoria realizada",
  QUOTE_SENT: "Orcamento enviado",
  NEGOTIATION: "Negociacao",
  WON: "Ganho",
  LOST: "Perdido",

  DRAFT: "Rascunho",
  SENT: "Enviado",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  EXPIRED: "Expirado",

  SCHEDULED: "Agendado",
  PREPARING: "Preparando",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  WAITING_CUSTOMER: "Aguardando cliente",
  DONE: "Concluido",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  DELAYED: "Atrasado",
  PENDING: "Pendente",
  BLOCKED: "Bloqueado",
  REOPENED: "Reaberto",

  PENDING_SEPARATION: "Pendente de separacao",
  SEPARATING: "Em separacao",
  SEPARATED: "Separado",
  DELIVERED_TO_TEAM: "Entregue para equipe",
  CONSUMED: "Consumido",
  RESERVED: "Reservado",
  REQUESTED: "Solicitado",
  IN_USE: "Em uso",
  RETURNED: "Devolvido",
  PARTIALLY_RETURNED: "Devolvido parcialmente",
  DAMAGED: "Danificado",
  AVAILABLE: "Disponivel",
  LOW_STOCK: "Estoque baixo",
  OUT_OF_STOCK: "Em falta",
  IN_MAINTENANCE: "Em manutencao",
  UNAVAILABLE: "Indisponivel",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  URGENT: "Urgente",
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baixa",

  PERSON: "Pessoa fisica",
  COMPANY: "Empresa",
  ARCHITECT: "Arquiteto",
  CONSTRUCTION_COMPANY: "Construtora",
  CONDOMINIUM: "Condominio",
  REAL_ESTATE: "Imobiliaria",

  MARBLE: "Marmore",
  GRANITE: "Granito",
  PORCELAIN: "Porcelanato",
  LIMESTONE: "Limestone",
  TRAVERTINE: "Travertino",
  SLATE: "Ardosia",
  WOOD: "Madeira",
  VINYL: "Vinilico",
  CEMENT: "Cimento queimado",
  OTHER: "Outro",

  POST_CONSTRUCTION_CLEANING: "Limpeza pos-obra",
  POLISHING: "Polimento",
  RESTORATION: "Restauracao",
  CRYSTALLIZATION: "Cristalizacao",
  WATERPROOFING: "Impermeabilizacao",
  STAIN_REMOVAL: "Remocao de manchas",
  GROUT_CLEANING: "Limpeza de rejunte",
  MAINTENANCE: "Manutencao",

  INSPECTION: "Vistoria",
  SERVICE_ORDER: "Ordem de servico",
  MATERIAL_PREPARATION: "Separacao de material",
  EQUIPMENT_RETURN: "Devolucao de equipamento",
  AFTER_SALES: "Pos-venda",
  INTERNAL_TASK: "Tarefa interna",

  BEFORE: "Antes",
  DURING: "Durante",
  AFTER: "Depois",
  EVIDENCE: "Evidencia",
  PROBLEM: "Problema",

  SUPERVISOR: "Supervisor",
  POLIDOR: "Polidor",
  AUXILIAR: "Auxiliar",
  MOTORISTA: "Motorista",
  OUTRO: "Outro",

  true: "Sim",
  false: "Nao",
};

function fallbackLabel(value: string) {
  const spaced = value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  if (!spaced) return "-";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function labelFor(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  const key = String(value);
  return labels[key] ?? fallbackLabel(key);
}

export function labelKey(key: string) {
  return fallbackLabel(key);
}
