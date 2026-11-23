import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().trim().optional(),
  SUPABASE_URL: z.string().trim().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().trim().optional(),
  JWT_SECRET: z.string().trim().min(24, "JWT_SECRET deve ter pelo menos 24 caracteres."),
  SESSION_MAX_AGE: z.coerce.number().int().positive().optional(),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().optional(),
  APP_URL: z.string().url().optional(),
  UPLOAD_PROVIDER: z.string().optional(),
});

let parsedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!parsedEnv) {
    const parsed = envSchema.safeParse({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
      JWT_SECRET: process.env.JWT_SECRET,
      SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
      SESSION_MAX_AGE_DAYS: process.env.SESSION_MAX_AGE_DAYS,
      APP_URL: process.env.APP_URL,
      UPLOAD_PROVIDER: process.env.UPLOAD_PROVIDER,
    });

    if (!parsed.success) {
      throw new Error("Configuracao de ambiente invalida. Verifique .env.example e defina as variaveis obrigatorias.");
    }

    parsedEnv = parsed.data;
  }

  return parsedEnv;
}

export function getSessionMaxAgeSeconds() {
  const seconds = Number(process.env.SESSION_MAX_AGE);
  const days = Number(process.env.SESSION_MAX_AGE_DAYS);
  const requested = Number.isFinite(seconds) && seconds > 0 ? seconds : Number.isFinite(days) && days > 0 ? days * 86400 : 7 * 86400;
  return Math.max(60, Math.min(Math.floor(requested), 30 * 86400));
}
