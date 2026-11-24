import Link from "next/link";
import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import type { UserRole } from "@/lib/types";

export type FieldProfileAccount = {
  userId: string | null; name: string; isActive: boolean; mustChangePassword?: boolean; role?: UserRole;
};
export function FieldProfileAccessCard({ account, viewerUserId }: { account: FieldProfileAccount; viewerUserId: string }) {
  const self = Boolean(account.userId && account.userId === viewerUserId);
  const eligible = Boolean(self && account.isActive && !account.mustChangePassword && account.role !== "COLABORADOR");
  const status = account.role === "COLABORADOR" ? "Não habilitado" : !account.userId ? "Sem acesso ao sistema" : !account.isActive ? "Conta inativa" : account.mustChangePassword ? "Troque a senha" : "Pronto";
  return (
    <Paper id="assistente-campo-perfil" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={1.6}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" spacing={1} alignItems="center"><MicRoundedIcon color="success"/><Typography fontWeight={800} variant="h6">Assistente de Campo</Typography></Stack>
          <Chip size="small" color={status === "Pronto" ? "success" : "default"} variant="outlined" label={status}/>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          Voz, texto, fotos e vídeos serão registrados no diário da obra escolhida, com o autor e horário de envio.
          Não precisa de WhatsApp nem de outro aplicativo.
        </Typography>
        <Button component={Link} href="/campo" variant="contained" color="success" disabled={!eligible} startIcon={<MicRoundedIcon/>} sx={{ alignSelf: "flex-start" }}>
          Abrir Assistente de Campo
        </Button>
        {account.role === "COLABORADOR" ? <Alert severity="info">O PWA é destinado aos perfis administrativos, supervisores e almoxarifado. O perfil COLABORADOR não possui acesso.</Alert>
          : !account.userId ? <Alert severity="info">Cadastre o usuário do sistema para liberar o acesso.</Alert>
          : !account.isActive ? <Alert severity="warning">A conta está desativada.</Alert>
          : account.mustChangePassword ? <Alert severity="warning">Troque a senha temporária antes de abrir.</Alert>
          : !self ? <Alert severity="info">Somente {account.name} pode abrir o assistente autenticado na própria conta. Entre com o login desse perfil para atribuir os relatos corretamente.</Alert>
          : <Typography variant="caption" color="text.secondary">Para instalar no celular, abra o assistente e use a opção de instalar o aplicativo.</Typography>}
      </Stack>
    </Paper>
  );
}
