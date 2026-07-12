"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import type { ModuleConfig } from "@/lib/module-config";

export function NewRecordView({ config }: { config: ModuleConfig }) {
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
            Novo registro
          </Typography>
          <Typography color="text.secondary">{config.title}</Typography>
        </Box>
        <Button component={Link} href={`/${config.key}`} startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {saved && <Alert severity="success">Registro preparado para persistencia na API do modulo.</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack component="form" spacing={2.2} onSubmit={handleSubmit}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <TextField label="Nome / titulo" required />
            <TextField label="Responsavel" />
            <TextField label="Telefone" />
            <TextField label="E-mail" type="email" />
            <TextField select label="Status" defaultValue="Ativo">
              <MenuItem value="Ativo">Ativo</MenuItem>
              <MenuItem value="Em analise">Em analise</MenuItem>
              <MenuItem value="Pendente">Pendente</MenuItem>
            </TextField>
            <TextField label="Valor estimado" type="number" />
          </Box>
          <TextField label="Observacoes internas" multiline minRows={4} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="flex-end">
            <Button component={Link} href={`/${config.key}`} variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />}>
              Salvar
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
