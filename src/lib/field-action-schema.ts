import { z } from "zod";

/** The model proposes one bounded action. Only server validation may execute it. */
export const fieldActionSchema = z.object({
  action: z.enum([
    "DIARY", "CLARIFY", "CREATE_CHECKLIST", "ASSIGN_CHECKLIST", "START_CHECKLIST", "COMPLETE_CHECKLIST", "BLOCK_CHECKLIST",
    "REQUEST_MATERIAL", "STOCK_NEW", "STOCK_RECEIVE", "STOCK_DISPATCH", "STOCK_RETURN", "STOCK_CONSUME", "STOCK_DAMAGE", "STOCK_LOSS",
    "EQUIPMENT_DISPATCH", "EQUIPMENT_RETURN", "EQUIPMENT_DAMAGE",
  ]),
  confidence: z.enum(["HIGH", "LOW"]),
  question: z.string().max(600),
  title: z.string().max(180),
  details: z.string().max(2500),
  employeeIds: z.array(z.string().max(160)).max(12),
  checklistItemId: z.string().max(160).nullable(),
  targetOrderId: z.string().max(160).nullable(),
  materialId: z.string().max(160).nullable(),
  equipmentId: z.string().max(160).nullable(),
  materialName: z.string().max(160),
  unit: z.string().max(45),
  quantity: z.number().finite().positive().max(100000).nullable(),
});
export type FieldAction = z.infer<typeof fieldActionSchema>;
export const diaryAction = (): FieldAction => ({
  action: "DIARY", confidence: "HIGH", question: "", title: "", details: "",
  employeeIds: [], checklistItemId: null, targetOrderId: null, materialId: null,
  equipmentId: null, materialName: "", unit: "", quantity: null,
});
