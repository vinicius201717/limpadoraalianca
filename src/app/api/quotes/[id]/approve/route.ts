import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { canApproveQuote } from "@/lib/permissions";
import { updateResource } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  if (!canApproveQuote(user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para aprovar orcamento." }, { status: 403 });
  }

  const { id } = await context.params;
  const quote = updateResource("quotes", id, { status: "APPROVED" });
  if (!quote) return NextResponse.json({ message: "Orcamento nao encontrado." }, { status: 404 });

  return NextResponse.json({ quote });
}
