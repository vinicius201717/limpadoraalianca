import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ConcurrentUpdateError, DatabaseUnavailableError } from "./app-state-db";
import { runWithStore } from "./request-store";
import { ensureDatabaseReady } from "./store";
import { getCurrentUserFromRequest } from "./auth";
import { AUTH_COOKIE, verifySessionPayload } from "./session-token";
import { consumeRateLimit } from "./rate-limit";

const MAX_BODY = 4 * 1024 * 1024;
class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export function withDatabase<C>(handler: (request: NextRequest, context: C) => Promise<Response>) {
  return async (original: NextRequest, context: C): Promise<Response> => {
    const requestId = randomUUID();
    let request = original;
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const allowedOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin;
        if (origin && origin !== allowedOrigin && origin !== request.nextUrl.origin) throw new RequestError("Origem não autorizada.", 403);
        if (request.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Origem não autorizada.", 403);
        if (Number(request.headers.get("content-length")) > MAX_BODY) throw new RequestError("Arquivo excede o limite. Use o envio direto de imagens.", 413);
        if (request.body) {
          const reader = request.body.getReader();
          const chunks: Uint8Array[] = []; let total = 0;
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            total += value.byteLength;
            if (total > MAX_BODY) { await reader.cancel(); throw new RequestError("Conteúdo excede 4 MB.", 413); }
            chunks.push(value);
          }
          request = new NextRequest(request.url, { method: request.method, headers: request.headers, body: Buffer.concat(chunks) });
        }
      }
      const path = request.nextUrl.pathname;
      if (path === "/api/auth/login" || path.startsWith("/api/public/") || path === "/api/checklist-media") {
        const identity = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
        const scope = path === "/api/auth/login" ? "login" : path === "/api/checklist-media" ? "media" : "public";
        const retryAfter = await consumeRateLimit(scope, identity, scope === "login" ? 20 : scope === "media" ? 600 : 120, 15 * 60_000);
        if (retryAfter) return NextResponse.json({ message: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
      }
      // Reject unauthenticated private calls before loading the entire operational snapshot.
      if (!path.startsWith("/api/public/") && !path.startsWith("/api/auth/") && !path.startsWith("/api/whatsapp/") && path !== "/api/checklist-media" && !verifySessionPayload(request.cookies.get(AUTH_COOKIE)?.value))
        return NextResponse.json({message:"Nao autenticado."},{status:401,headers:{"Cache-Control":"no-store","X-Request-Id":requestId}});
      const response = await runWithStore(async () => {
        if (path !== "/api/auth/logout") await ensureDatabaseReady();
        if (!path.startsWith("/api/public/") && !path.startsWith("/api/auth/") && path !== "/api/checklist-media") {
          const user = await getCurrentUserFromRequest(request);
          if (user?.mustChangePassword) return NextResponse.json({ message: "Altere sua senha em Configurações antes de continuar.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
        }
        return handler(request, context);
      });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      const status = error instanceof ConcurrentUpdateError ? 409 : error instanceof DatabaseUnavailableError ? 503 : error instanceof RequestError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
      const message = status === 409 ? "Outra operação atualizou os dados. Atualize a tela e tente novamente." : status === 503 ? "O banco está temporariamente indisponível. Nenhuma alteração foi confirmada." : status === 400 ? "Dados inválidos. Revise os campos enviados." : error instanceof RequestError ? error.message : "Não foi possível concluir a operação.";
      console.error(JSON.stringify({ event: "api_failure", requestId, path: original.nextUrl.pathname, status, type: error instanceof Error ? error.name : "Unknown" }));
      return NextResponse.json({ message, requestId }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
    }
  };
}
