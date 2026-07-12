"use client";

import Link from "next/link";
import { Alert, Button, Stack, Typography } from "@mui/material";

export function AccessDeniedView({ message = "Voce nao possui permissao para acessar esta area." }: { message?: string }) {
  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
        Acesso restrito
      </Typography>
      <Alert severity="error">{message}</Alert>
      <Button component={Link} href="/dashboard" variant="contained" sx={{ alignSelf: "flex-start" }}>
        Voltar ao dashboard
      </Button>
    </Stack>
  );
}
