import type { SystemUser } from "./types";
import type { WhatsAppLink } from "./whatsapp-types";

/** Read-only profile information. Never expose pending link tokens or full phone numbers. */
export function whatsappProfileStatus(
  account: Pick<SystemUser, "id" | "isActive" | "sessionVersion" | "mustChangePassword"> | null | undefined,
  links: readonly WhatsAppLink[],
) {
  const link = account && links.find((entry) => entry.userId === account.id);
  const phone = link?.phone;
  const linked = Boolean(account?.isActive && !account.mustChangePassword && phone && link?.sessionVersion === (account.sessionVersion ?? 0));
  return {
    linked,
    maskedPhone: linked && phone ? `•••• ${phone.slice(-4)}` : null,
  };
}
