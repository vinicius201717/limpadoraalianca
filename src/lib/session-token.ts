import jwt from "jsonwebtoken";
import {createHash,randomUUID} from "node:crypto";
import { z } from "zod";

import { getEnv, getSessionMaxAgeSeconds } from "./env";
import type { SessionUser } from "./types";

export const AUTH_COOKIE = "floor_session";
export const SESSION_MAX_AGE_SECONDS = getSessionMaxAgeSeconds();

const sessionPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]),
  isActive: z.boolean(),
  canViewFinancials: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  sessionVersion: z.number().int().nonnegative().default(0),
});

function getJwtSecret() {
  return getEnv().JWT_SECRET;
}

export function signSessionToken(user: SessionUser) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      canViewFinancials: user.canViewFinancials,
      sessionVersion: user.sessionVersion ?? 0,
      mustChangePassword: user.mustChangePassword,
    },
    getJwtSecret(),
    { jwtid:randomUUID(), expiresIn: SESSION_MAX_AGE_SECONDS, algorithm: "HS256", issuer: "alianca", audience: "alianca-web" },
  );
}

export const sessionTokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export function verifySessionPayload(token?: string): SessionUser | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], issuer: "alianca", audience: "alianca-web", maxAge: SESSION_MAX_AGE_SECONDS });
    const parsed = sessionPayloadSchema.safeParse(decoded);
    if (!parsed.success || parsed.data.isActive === false) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
