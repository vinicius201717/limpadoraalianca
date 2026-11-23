import { z } from "zod";

const commonPasswords = new Set(["123456", "1234567890", "password123", "alianca2026"]);

export const newPasswordSchema = z.string().min(10, "Use pelo menos 10 caracteres.")
  .max(72, "Use no maximo 72 caracteres.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "A senha excede o limite de 72 bytes.")
  .refine((value) => !commonPasswords.has(value.toLowerCase()), "Escolha uma senha exclusiva; senhas padrao nao sao permitidas.");
