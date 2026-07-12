import jwt from "jsonwebtoken";
import { z } from "zod";

import { getEnv, getSessionMaxAgeSeconds } from "./env";
import type { SessionUser } from "./types";

export const AUTH_COOKIE = "floor_session";
export const SESSION_MAX_AGE_SECONDS = getSessionMaxAgeSeconds();

const sessionPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]),
  isActive: z.boolean(),
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
      role: user.role,
      isActive: user.isActive,
    },
    getJwtSecret(),
    { expiresIn: SESSION_MAX_AGE_SECONDS },
  );
}

export function verifySessionPayload(token?: string): SessionUser | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const parsed = sessionPayloadSchema.safeParse(decoded);
    if (!parsed.success || parsed.data.isActive === false) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
