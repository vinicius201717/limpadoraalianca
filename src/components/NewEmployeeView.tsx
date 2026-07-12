"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { labelFor } from "@/lib/labels";
import { canCreateEmployee } from "@/lib/permissions";
import { useCurrentUser } from "./useCurrentUser";

const cargoOptions = ["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"] as const;

const employeeSchema = z.object({
  name: z.string().min(3, "Informe o nome"),
  email: z.string().email("Informe um e-mail valido"),
  phone: z.string().min(8, "Informe o telefone"),
  cargo: z.enum(cargoOptions),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "FIRED"]),
  dailyCost: z.coerce.number().min(0),
});

type EmployeeFormInput = z.input<typeof employeeSchema>;
type EmployeeForm = z.output<typeof employeeSchema>;

export function NewEmployeeView() {
  const { user, loading } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const allowed = canCreateEmployee(user?.role ?? "COLABORADOR");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      cargo: "COLABORADOR",
      status: "ACTIVE",
      dailyCost: 0,
    },
  });
  const visibleCargoOptions =
    user?.role === "OWNER" ? cargoOptions : cargoOptions.filter((option) => option === "COLABORADOR" || option === "SUPERVISOR_OBRA");

  async function onSubmit(values: EmployeeForm) {
    setMessage("");
    setError("");

    const cargoLabel = labelFor(values.cargo);
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        phone: values.phone,
        cargo: values.cargo,
        roleName: cargoLabel,
        jobTitle: cargoLabel,
        specialty: cargoLabel,
        status: values.status,
        dailyCost: values.dailyCost,
        createAccess: true,
        accessRole: values.cargo,
        temporaryPassword: "123456",
      }),
    });

    if (response.status === 403) {
      setError("Voce nao possui permissao para executar esta acao.");
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Nao foi possivel criar o colaborador.");
      return;
    }

    const data = await response.json();
    setMessage(data.message ?? `${data.employee.name} criado com sucesso. Senha temporaria: 123456.`);
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!allowed) {
    return (
      <Stack spacing={2}>
        <Button component={Link} href="/colaboradores" startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
          Voltar
        </Button>
        <Alert severity="error">Voce nao possui permissao para executar esta acao.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
            Novo colaborador
          </Typography>
          <Typography color="text.secondary">Cadastro rapido com acesso ao sistema criado automaticamente.</Typography>
        </Box>
        <Button component={Link} href="/colaboradores" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack component="form" spacing={2.2} onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
            <TextField label="Nome" {...register("name")} error={Boolean(errors.name)} helperText={errors.name?.message} />
            <TextField label="E-mail" {...register("email")} error={Boolean(errors.email)} helperText={errors.email?.message} />
            <TextField label="Telefone" {...register("phone")} error={Boolean(errors.phone)} helperText={errors.phone?.message} />
            <Controller
              control={control}
              name="cargo"
              render={({ field }) => (
                <TextField select label="Cargo" {...field} error={Boolean(errors.cargo)} helperText={errors.cargo?.message}>
                  {visibleCargoOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {labelFor(option)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <TextField select label="Status" {...field}>
                  <MenuItem value="ACTIVE">Ativo</MenuItem>
                  <MenuItem value="INACTIVE">Inativo</MenuItem>
                  <MenuItem value="ON_LEAVE">Afastado</MenuItem>
                  <MenuItem value="FIRED">Desligado</MenuItem>
                </TextField>
              )}
            />
            <TextField label="Custo diario" type="number" {...register("dailyCost")} />
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="flex-end">
            <Button component={Link} href="/colaboradores" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={isSubmitting}>
              Criar colaborador
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
