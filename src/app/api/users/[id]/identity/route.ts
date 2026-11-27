import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db, recordAuditLog } from "@/lib/store";
import { identitySchema } from "@/lib/user-identity-schema";
import { identitySummary, identityPhoto, saveUserIdentity, IdentityError } from "@/lib/user-identity";

type Context = { params: Promise<{ id: string }> };
async function GETHandler(request: NextRequest, context: Context) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (auth.user.role !== "OWNER") return NextResponse.json({ message: "Acesso restrito ao dono." }, { status: 403 });
  const { id } = await context.params;
  if (!db.users.some(u => u.id === id)) return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  const side = request.nextUrl.searchParams.get("side");
  try {
    if (side === "both") {
      const [front, back] = await Promise.all([identityPhoto(id, "front"), identityPhoto(id, "back")]);
      if (!front || !back) return NextResponse.json({ message: "Documento nao cadastrado." }, { status: 404 });
      recordAuditLog({ userId: auth.user.id, action: "VIEW_USER_DOCUMENT", entity: "User", entityId: id, metadata: { side: "both" } });
      return NextResponse.json({ front: "data:image/jpeg;base64," + front.toString("base64"), back: "data:image/jpeg;base64," + back.toString("base64") });
    }
    if (side !== null) {
      if (side !== "front" && side !== "back") return NextResponse.json({ message: "Lado invalido." }, { status: 400 });
      const photo = await identityPhoto(id, side);
      if (!photo) return NextResponse.json({ message: "Documento nao cadastrado." }, { status: 404 });
      recordAuditLog({ userId: auth.user.id, action: "VIEW_USER_DOCUMENT", entity: "User", entityId: id, metadata: { side } });
      return new NextResponse(new Uint8Array(photo), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
    }
    const identity = identitySummary(id);
    if (identity) recordAuditLog({ userId: auth.user.id, action: "VIEW_USER_IDENTITY", entity: "User", entityId: id });
    return NextResponse.json({ identity });
  } catch (error) {
    if (error instanceof IdentityError) return NextResponse.json({ message: error.message }, { status: 503 });
    throw error;
  }
}
async function PUTHandler(request: NextRequest, context: Context) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (auth.user.role !== "OWNER") return NextResponse.json({ message: "Acesso restrito ao dono." }, { status: 403 });
  const { id } = await context.params;
  if (!db.users.some(u => u.id === id)) return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  const parsed = identitySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Informe CPF valido e as duas fotos do documento." }, { status: 400 });
  try {
    await saveUserIdentity(id, parsed.data, auth.user.id);
    return NextResponse.json({ message: "Documentacao salva." });
  } catch (error) {
    if (error instanceof IdentityError) return NextResponse.json({ message: error.message }, { status: 422 });
    throw error;
  }
}
export const GET = withDatabase(GETHandler);
export const PUT = withDatabase(PUTHandler);
