"use client";
import { Alert, Button, Stack, Typography } from "@mui/material";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Stack spacing={2} sx={{ p: 4 }}><Typography variant="h5">Não foi possível carregar os dados</Typography><Alert severity="error">O serviço está temporariamente indisponível. Tente novamente em instantes. Se o problema continuar, contate o administrador.</Alert><Button onClick={reset} variant="contained">Tentar novamente</Button></Stack>;
}
