import { z } from "zod";

export const serviceTypes = ["POST_CONSTRUCTION_CLEANING", "RESTORATION", "POLISHING", "CRYSTALLIZATION", "WATERPROOFING", "STAIN_REMOVAL", "GROUT_CLEANING", "MAINTENANCE", "OTHER"] as const;
const text = z.string().trim().max(4000);
const optionalId = z.string().trim().max(150).optional();
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");
export const dateTime = z.string().datetime({ offset: true });
const money = z.coerce.number().finite().min(0).max(1_000_000_000).transform((value) => Math.round(value * 100) / 100);
const email = z.union([z.email(), z.literal("")]).default("");

export const customerSchema = z.object({
  name: text.min(2), phone: z.string().trim().min(8).max(30), email,
  document: z.string().trim().max(30).default(""),
  type: z.enum(["PERSON", "CONDOMINIUM", "ARCHITECT", "CONSTRUCTION_COMPANY", "COMPANY"]).default("PERSON"),
  source: text.default("Cadastro manual"), address: text.default(""), notes: text.default(""),
}).strict();
export const leadSchema = z.object({
  name: text.min(2), phone: z.string().trim().min(8).max(30), email,
  source: text.min(2), status: z.enum(["NEW", "CONTACTED", "INSPECTION_SCHEDULED", "INSPECTION_DONE", "QUOTE_SENT", "NEGOTIATION", "WON", "LOST"]).default("NEW"),
  estimatedValue: money.default(0), nextFollowUpAt: dateOnly, notes: text.default(""),
}).strict();
export const inspectionSchema = z.object({
  customerId: z.string().min(1).max(150), leadId: optionalId,
  address: text.min(5), surfaceType: text.min(2), serviceType: z.enum(serviceTypes),
  areaM2: z.coerce.number().finite().positive().max(1_000_000), currentState: text.min(3),
  technicalRisk: z.enum(["LOW", "MEDIUM", "HIGH"]), inspectionDate: dateTime,
  notes: text.default(""),
}).strict();
export const quoteSchema = z.object({
  customerId: z.string().min(1).max(150), leadId: optionalId, inspectionId: optionalId,
  title: text.min(3), serviceType: z.enum(serviceTypes), address: text.min(5), description: text.min(3),
  status: z.enum(["DRAFT", "SENT", "REJECTED", "EXPIRED"]).default("DRAFT"),
  validUntil: dateOnly, subtotal: money, discount: money.default(0), paymentTerms: text.min(3),
}).strict().refine((data) => data.discount <= data.subtotal, { path: ["discount"], message: "O desconto não pode superar o subtotal." });
export const approvalSchema = z.object({
  scheduledStart: dateTime, scheduledEnd: dateTime,
  acceptanceNotes: text.min(5, "Registre como o cliente aprovou a proposta."),
}).strict().refine((data) => Date.parse(data.scheduledEnd) > Date.parse(data.scheduledStart), { path: ["scheduledEnd"], message: "O fim precisa ser posterior ao início." });
export const warrantySchema = z.object({
  serviceOrderId: z.string().min(1).max(150), startsAt: dateOnly, endsAt: dateOnly,
  terms: text.min(10), status: z.enum(["ACTIVE", "CLAIM_OPEN", "CLOSED", "CANCELED"]).default("ACTIVE"),
  claimNotes: text.default(""),
}).strict().refine((data) => data.endsAt >= data.startsAt, { path: ["endsAt"], message: "O fim da garantia não pode anteceder o início." })
  .refine((data) => data.status !== "CLAIM_OPEN" || data.claimNotes.length >= 5, { path: ["claimNotes"], message: "Descreva o acionamento da garantia." });

export type CommercialModule = "clientes" | "leads" | "vistorias" | "orcamentos" | "garantias";
export const commercialResources = { clientes: "customers", leads: "leads", vistorias: "inspections", orcamentos: "quotes", garantias: "warranties" } as const;
export const commercialSchemas = { clientes: customerSchema, leads: leadSchema, vistorias: inspectionSchema, orcamentos: quoteSchema, garantias: warrantySchema };
export function isCommercialModule(value: string): value is CommercialModule { return value in commercialResources; }
export function businessDate(value = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }

export type RecordField = { key: string; label: string; type?: "number" | "email" | "date" | "datetime-local"; required?: boolean; multiline?: boolean; options?: readonly string[]; relation?: "customers" | "orders"; defaultValue?: string | number };
const contactFields: RecordField[] = [{ key: "name", label: "Nome", required: true }, { key: "phone", label: "Telefone", required: true }, { key: "email", label: "E-mail", type: "email" }, { key: "source", label: "Origem", required: true, defaultValue: "Cadastro manual" }];
const customerField: RecordField = { key: "customerId", label: "Cliente", relation: "customers", required: true };
const serviceFields: RecordField[] = [{ key: "serviceType", label: "Tipo de serviço", options: serviceTypes, required: true, defaultValue: "RESTORATION" }, { key: "address", label: "Endereço da obra", required: true }];
export const commercialFields: Record<CommercialModule, RecordField[]> = {
  clientes: [...contactFields, { key: "document", label: "CPF / CNPJ" }, { key: "type", label: "Tipo", options: ["PERSON", "CONDOMINIUM", "ARCHITECT", "CONSTRUCTION_COMPANY", "COMPANY"], defaultValue: "PERSON" }, { key: "address", label: "Endereço" }, { key: "notes", label: "Observações", multiline: true }],
  leads: [...contactFields, { key: "status", label: "Etapa comercial", options: ["NEW", "CONTACTED", "INSPECTION_SCHEDULED", "INSPECTION_DONE", "QUOTE_SENT", "NEGOTIATION", "WON", "LOST"], defaultValue: "NEW" }, { key: "estimatedValue", label: "Valor estimado (R$)", type: "number", defaultValue: 0 }, { key: "nextFollowUpAt", label: "Próximo contato", type: "date", required: true }, { key: "notes", label: "Observações", multiline: true }],
  vistorias: [customerField, ...serviceFields, { key: "surfaceType", label: "Superfície", required: true }, { key: "areaM2", label: "Área (m²)", type: "number", required: true }, { key: "inspectionDate", label: "Data da vistoria", type: "datetime-local", required: true }, { key: "technicalRisk", label: "Risco técnico", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "LOW" }, { key: "currentState", label: "Condição atual", multiline: true, required: true }, { key: "notes", label: "Recomendações e observações", multiline: true }],
  orcamentos: [customerField, { key: "title", label: "Título da proposta", required: true }, ...serviceFields, { key: "description", label: "Escopo e serviços incluídos", multiline: true, required: true }, { key: "subtotal", label: "Valor dos serviços (R$)", type: "number", required: true }, { key: "discount", label: "Desconto (R$)", type: "number", defaultValue: 0 }, { key: "validUntil", label: "Validade", type: "date", required: true }, { key: "paymentTerms", label: "Condições de pagamento", multiline: true, required: true }, { key: "status", label: "Situação", options: ["DRAFT", "SENT", "REJECTED", "EXPIRED"], defaultValue: "DRAFT" }],
  garantias: [{ key: "serviceOrderId", label: "Serviço entregue", relation: "orders", required: true }, { key: "startsAt", label: "Início da garantia", type: "date", required: true }, { key: "endsAt", label: "Fim da garantia", type: "date", required: true }, { key: "terms", label: "Termos, cobertura e exclusões", multiline: true, required: true }, { key: "status", label: "Situação", options: ["ACTIVE", "CLAIM_OPEN", "CLOSED", "CANCELED"], defaultValue: "ACTIVE" }, { key: "claimNotes", label: "Acionamento e resolução", multiline: true }],
};
