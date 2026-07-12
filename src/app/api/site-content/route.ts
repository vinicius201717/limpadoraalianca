import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import {
  createSiteBeforeAfter,
  createSiteTestimonial,
  db,
  ensureDatabaseReady,
} from "@/lib/store";

const imageReferenceSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith("/uploads/site/") || z.string().url().safeParse(value).success, {
    message: "Informe uma URL valida ou uma imagem enviada pelo sistema.",
  });

const beforeAfterSchema = z.object({
  type: z.literal("beforeAfter"),
  title: z.string().trim().min(3).max(120),
  serviceType: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(90),
  beforeImageUrl: imageReferenceSchema,
  afterImageUrl: imageReferenceSchema,
  description: z.string().trim().min(10).max(360),
});

const testimonialSchema = z.object({
  type: z.literal("testimonial"),
  customerName: z.string().trim().min(2).max(100),
  roleOrNeighborhood: z.string().trim().min(2).max(100),
  rating: z.coerce.number().min(1).max(5),
  quote: z.string().trim().min(10).max(420),
  serviceType: z.string().trim().min(2).max(80),
});

const siteContentSchema = z.discriminatedUnion("type", [beforeAfterSchema, testimonialSchema]);

export async function GET() {
  await ensureDatabaseReady();
  return NextResponse.json({
    beforeAfters: db.siteBeforeAfters.filter((item) => item.isPublished),
    testimonials: db.siteTestimonials.filter((item) => item.isPublished),
  });
}

export async function POST(request: NextRequest) {
  await ensureDatabaseReady();
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para publicar no site." }, { status: 403 });
  }

  const parsed = siteContentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.type === "beforeAfter") {
    const { type, ...data } = parsed.data;
    void type;
    return NextResponse.json({ beforeAfter: createSiteBeforeAfter(data, auth.user) }, { status: 201 });
  }

  const { type, ...data } = parsed.data;
  void type;
  return NextResponse.json({ testimonial: createSiteTestimonial(data, auth.user) }, { status: 201 });
}
