"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { labelFor } from "@/lib/labels";
import type { Employee, UserRole } from "@/lib/types";

const roles: UserRole[] = [
  "GERENTE",
  "SUPERVISOR_OBRA",
  "ALMOXARIFADO",
  "COMERCIAL",
  "TECNICO",
  "FINANCEIRO",
  "COLABORADOR",
];

export function NewUserView({ employees }: { employees: Employee[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("COLABORADOR");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [linkedEmployeeId, setLinkedEmployeeId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setSaving(true);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        role,
        temporaryPassword,
        linkedEmployeeId: linkedEmployeeId || undefined,
        isActive,
        canViewFinancials: role === "GERENTE" ? canViewFinancials : false,
      }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);

    if (response.status === 403) {
      setError(data?.message ?? "Voce nao possui permissao para executar esta acao.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel criar usuario.");
      return;
    }

    setNotice(data?.message ?? "Usuario criado com sucesso.");
    setName("");
    setEmail("");
    setPhone("");
    setRole("COLABORADOR");
    setCanViewFinancials(false);
    setLinkedEmployeeId("");
    setTemporaryPassword("");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
            Novo usuario
          </Typography>
          <Typography color="text.secondary">Criacao de acesso interno com perfil e vinculo opcional ao colaborador.</Typography>
        </Box>
        <Button component={Link} href="/usuarios" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack component="form" spacing={2.2} onSubmit={submit}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <TextField label="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
            <TextField
              label="Telefone de login"
              type="tel"
              inputMode="tel"
              placeholder="62999999999"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <TextField label="E-mail opcional" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <TextField select label="Perfil" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {roles.map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Senha temporaria"
              type="password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              required
            />
            <TextField select label="Colaborador vinculado" value={linkedEmployeeId} onChange={(event) => setLinkedEmployeeId(event.target.value)}>
              <MenuItem value="">Sem vinculo</MenuItem>
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.name}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel control={<Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />} label="Usuario ativo" />
            <FormControlLabel
              control={
                <Checkbox
                  checked={role === "FINANCEIRO" || (role === "GERENTE" && canViewFinancials)}
                  disabled={role !== "GERENTE"}
                  onChange={(event) => setCanViewFinancials(event.target.checked)}
                />
              }
              label={role === "FINANCEIRO" ? "Acesso financeiro liberado pelo perfil" : "Permitir acesso financeiro para gerente"}
            />
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="flex-end">
            <Button component={Link} href="/usuarios" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving}>
              Criar usuario
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
