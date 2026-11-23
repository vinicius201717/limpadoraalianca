import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageChecklistTemplates } from "@/lib/permissions";
import { db, deleteChecklistTemplate, updateChecklistTemplate } from "@/lib/store";

const templateItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  minimumPhotos: z.coerce.number().int().min(0).max(20).optional(),
});

const templateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  serviceType: z
    .enum(["POST_CONSTRUCTION_CLEANING", "POLISHING", "RESTORATION", "CRYSTALLIZATION", "WATERPROOFING", "STAIN_REMOVAL", "GROUT_CLEANING", "MAINTENANCE", "OTHER"])
    .optional(),
  isActive: z.boolean().optional(),
  items: z.array(templateItemSchema).optional(),
});

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const template = db.checklistTemplates.find((item) => item.id === id);
  if (!template) return NextResponse.json({ message: "Template nao encontrado." }, { status: 404 });
  return NextResponse.json({
    template,
    items: db.checklistTemplateItems.filter((item) => item.templateId === id).sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageChecklistTemplates(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar templates." }, { status: 403 });
  }
  const { id } = await context.params;
  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  const result = updateChecklistTemplate(id, parsed.data, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Template nao encontrado." }, { status: 404 });
  return NextResponse.json(result);
}

async function DELETEHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageChecklistTemplates(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover templates." }, { status: 403 });
  }
  const { id } = await context.params;
  const result = deleteChecklistTemplate(id, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Template nao encontrado." }, { status: 404 });
  return NextResponse.json(result);
}

export const GET = withDatabase(GETHandler);
export const PATCH = withDatabase(PATCHHandler);
export const DELETE = withDatabase(DELETEHandler);
