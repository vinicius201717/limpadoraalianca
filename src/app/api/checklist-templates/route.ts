import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageChecklistTemplates } from "@/lib/permissions";
import { createChecklistTemplate, db } from "@/lib/store";

const templateItemSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  minimumPhotos: z.coerce.number().int().min(0).max(20).optional(),
});

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  serviceType: z
    .enum(["POST_CONSTRUCTION_CLEANING", "POLISHING", "RESTORATION", "CRYSTALLIZATION", "WATERPROOFING", "STAIN_REMOVAL", "GROUT_CLEANING", "MAINTENANCE", "OTHER"])
    .optional(),
  items: z.array(templateItemSchema).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const templates = db.checklistTemplates.map((template) => ({
    ...template,
    items: db.checklistTemplateItems.filter((item) => item.templateId === template.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageChecklistTemplates(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar templates." }, { status: 403 });
  }
  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  const result = createChecklistTemplate(parsed.data, auth.user);
  return NextResponse.json(result, { status: 201 });
}
