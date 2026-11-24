"use client";

import Link from "next/link";
import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

export type WhatsAppProfileAccount = {
  userId: string | null;
  name: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  linked: boolean;
  maskedPhone: string | null;
};

export function WhatsAppProfileAccessCard({
  account,
  viewerUserId,
}: {
  account: WhatsAppProfileAccount;
  viewerUserId: string;
}) {
  const isOwnProfile = Boolean(account.userId && account.userId === viewerUserId);
  const canOpenAssistant = isOwnProfile && account.isActive && !account.mustChangePassword;

  const status = !account.userId
    ? "Sem acesso ao sistema"
    : !account.isActive
      ? "Conta inativa"
      : account.mustChangePassword
      ? "Atualize sua senha"
      : account.linked
        ? "Vinculado"
        : "Não vinculado";

  return (
    <Paper id="assistente-whatsapp-perfil" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WhatsAppIcon color="success" />
            <Typography variant="h6">Assistente WhatsApp do perfil</Typography>
          </Stack>
          <Chip size="small" label={status} color={account.linked && account.isActive ? "success" : "default"} variant="outlined" />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {account.name} terá as mensagens atribuídas à própria conta, com acesso somente às obras e funções permitidas pelo seu perfil.
        </Typography>

        {account.linked && account.maskedPhone && account.isActive && (
          <Typography variant="body2">WhatsApp vinculado: {account.maskedPhone}</Typography>
        )}

        {canOpenAssistant ? (
          <Button component={Link} href="/assistente-whatsapp" variant="contained" color="success" startIcon={<WhatsAppIcon />} sx={{ alignSelf: "flex-start" }}>
            {account.linked ? "Abrir meu Assistente WhatsApp" : "Vincular meu WhatsApp"}
          </Button>
        ) : (
          <Button variant="outlined" color="success" startIcon={<WhatsAppIcon />} disabled sx={{ alignSelf: "flex-start" }}>
            Vincular WhatsApp deste perfil
          </Button>
        )}

        {!account.userId ? (
          <Alert severity="info">Primeiro libere um usuário de acesso ao sistema para este colaborador. O WhatsApp não cria uma conta automaticamente.</Alert>
        ) : !account.isActive ? (
          <Alert severity="warning">É necessário reativar a conta de acesso antes de vincular o WhatsApp.</Alert>
        ) : account.mustChangePassword ? (
          <Alert severity="warning">Troque sua senha temporária pelo sistema antes de vincular o WhatsApp.</Alert>
        ) : !isOwnProfile ? (
          <Alert severity="info">
            Para proteger a identidade de {account.name}, somente o titular pode entrar com a própria conta e confirmar o vínculo pelo WhatsApp.
            Este botão não troca o perfil do administrador nem vincula seu número a outra pessoa.
          </Alert>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Ao abrir o assistente, gere uma mensagem temporária de vínculo e envie-a pelo seu WhatsApp.
            O sistema só reconhecerá o número após receber a confirmação pelo webhook oficial da Meta.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
