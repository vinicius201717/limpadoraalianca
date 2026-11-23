import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { labelFor } from "@/lib/labels";
import {
  db,
  ensureDatabaseReady,
  findServiceOrderByClientAccessCode,
  normalizeClientAccessCode,
} from "@/lib/store";

const trackingSchema = z.object({
  code: z.string().min(4).max(40),
});

function publicChecklistStatusLabel(status: string) {
  if (status === "PENDING" || status === "REOPENED") return "Pendente";
  if (status === "IN_PROGRESS") return "Iniciado";
  if (status === "DONE") return "Concluido";
  return labelFor(status);
}

function buildPublicTrackingPayload(code: string) {
  const order = findServiceOrderByClientAccessCode(code);
  if (!order) return null;

  const checklist = db.serviceOrderChecklistItems
    .filter((item) => item.serviceOrderId === order.id && item.status !== "CANCELED")
    .sort((a, b) => Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority)) || a.sortOrder - b.sortOrder);

  const photos = db.serviceOrderChecklistPhotos
    .filter((photo) => photo.serviceOrderId === order.id)
    .map((photo) => ({
      id: photo.id,
      checklistItemId: photo.checklistItemId,
      type: photo.type,
      typeLabel: labelFor(photo.type),
      url: photo.url.startsWith("/api/checklist-media?") ? `${photo.url}&code=${encodeURIComponent(code)}` : photo.url,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      caption: photo.caption,
      createdAt: photo.createdAt,
    }));

  const completed = checklist.filter((item) => item.status === "DONE").length;
  const total = checklist.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const nextItem = checklist.find((item) => item.status !== "DONE");
  const lastChecklistUpdate = checklist.reduce<string | undefined>((latest, item) => {
    if (!latest || new Date(item.updatedAt).getTime() > new Date(latest).getTime()) return item.updatedAt;
    return latest;
  }, undefined);

  return {
    serviceOrder: {
      id: order.id,
      title: order.title,
      customerName: order.customerName,
      serviceType: order.serviceType,
      status: order.status,
      address: order.address,
      scheduledStart: order.scheduledStart,
      scheduledEnd: order.scheduledEnd,
      clientNotes: order.clientNotes,
      lastUpdateAt: lastChecklistUpdate ?? order.scheduledStart,
      delivery: {
        signedAt: order.clientDeliverySignedAt,
        signedBy: order.clientDeliveryAcceptedBy,
        rating: order.clientRating,
        feedback: order.clientFeedback,
        signatureUrl: order.clientDeliverySignatureUrl,
      },
    },
    progress: {
      total,
      completed,
      pending: checklist.filter((item) => item.status === "PENDING" || item.status === "REOPENED").length,
      inProgress: checklist.filter((item) => item.status === "IN_PROGRESS").length,
      blocked: checklist.filter((item) => item.status === "BLOCKED").length,
      percent,
      nextItemTitle: nextItem?.title ?? "",
    },
    checklist: checklist.map((item) => {
      const itemPhotos = photos.filter((photo) => photo.checklistItemId === item.id);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        statusLabel: publicChecklistStatusLabel(item.status),
        startedAt: item.startedAt,
        isPriority: Boolean(item.isPriority),
        requiresPhoto: item.requiresPhoto,
        minimumPhotos: item.minimumPhotos,
        completedAt: item.completedAt,
        validatedAt: item.validatedAt,
        updatedAt: item.updatedAt,
        photoCount: itemPhotos.length,
        photos: itemPhotos,
      };
    }),
  };
}

async function resolveTracking(request: NextRequest) {
  await ensureDatabaseReady();

  const rawCode =
    request.method === "GET"
      ? request.nextUrl.searchParams.get("code") ?? request.nextUrl.searchParams.get("codigo") ?? ""
      : trackingSchema.safeParse(await request.json().catch(() => ({}))).data?.code ?? "";
  const code = normalizeClientAccessCode(rawCode);

  if (!code) {
    return NextResponse.json({ message: "Informe o codigo de acompanhamento." }, { status: 400 });
  }

  const payload = buildPublicTrackingPayload(code);
  if (!payload) {
    return NextResponse.json({ message: "Codigo nao encontrado ou acesso indisponivel." }, { status: 404 });
  }

  return NextResponse.json(payload);
}

async function GETHandler(request: NextRequest) {
  return resolveTracking(request);
}

async function POSTHandler(request: NextRequest) {
  return resolveTracking(request);
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
