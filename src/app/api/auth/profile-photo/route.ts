import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";
import { db, flushDatabasePersistence, recordAuditLog, toPublicUser } from "@/lib/store";

const maxAvatarBytes = 1_500_000;
const profilePhotoSchema = z.object({
  avatarUrl: z
    .string()
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[\s\S]+$/i, "Imagem invalida.")
    .optional()
    .or(z.literal("")),
});

function dataUrlByteSize(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Buffer.from(base64, "base64").byteLength;
}

async function PATCHHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = profilePhotoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Foto invalida. Use JPEG, PNG ou WebP." }, { status: 400 });
  }

  const avatarUrl = parsed.data.avatarUrl?.trim() ?? "";
  if (avatarUrl && dataUrlByteSize(avatarUrl) > maxAvatarBytes) {
    return NextResponse.json({ message: "Foto muito pesada. Use uma imagem de ate 1,5 MB." }, { status: 400 });
  }

  const user = db.users.find((item) => item.id === auth.user.id);
  if (!user) return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });

  const oldValueJson = { avatarUrl: user.avatarUrl };
  user.avatarUrl = avatarUrl || undefined;
  user.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_PROFILE_PHOTO",
    entity: "User",
    entityId: user.id,
    oldValueJson,
    newValueJson: { avatarUrl: Boolean(user.avatarUrl) },
  });
  await flushDatabasePersistence();

  const publicUser = toPublicUser(user);
  const response = NextResponse.json({ message: "Foto de perfil atualizada.", user: publicUser });
  response.cookies.set(AUTH_COOKIE, signSession(publicUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const PATCH = withDatabase(PATCHHandler);
