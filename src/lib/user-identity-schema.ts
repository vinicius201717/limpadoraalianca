import { z } from "zod";

export function normalizeCpf(value: string) { return value.replace(/\D/g, ""); }
export function validCpf(value: string) {
  if (!/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value)) return false;
  const cpf = normalizeCpf(value);
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    const sum = Array.from(cpf.slice(0, length)).reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    if (Number(cpf[length]) !== (sum * 10 % 11) % 10) return false;
  }
  return true;
}
export function formatCpf(value: string) {
  return normalizeCpf(value).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2").replace(/(\.\d{3})(\d)/, "$1-$2");
}
export const MAX_DOCUMENT_BYTES = 1250 * 1024;
const photo = z.string().max(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 64).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);
export const identitySchema = z.object({
  cpf: z.string().trim().refine(validCpf, "CPF invalido.").transform(normalizeCpf),
  address: z.string().trim().max(500).optional().default(""),
  front: photo,
  back: photo,
}).strict();
export type IdentityInput = z.output<typeof identitySchema>;
export type IdentityDraft = { cpf: string; address: string; front: string; back: string };
export const emptyIdentity = (): IdentityDraft => ({ cpf: "", address: "", front: "", back: "" });
