"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { labelFor } from "@/lib/labels";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import type { Employee, ServiceType } from "@/lib/types";
import { useCurrentUser } from "./useCurrentUser";

const serviceTypeOptions = [
  "POST_CONSTRUCTION_CLEANING",
  "RESTORATION",
  "POLISHING",
  "CRYSTALLIZATION",
  "WATERPROOFING",
  "STAIN_REMOVAL",
  "GROUT_CLEANING",
  "MAINTENANCE",
  "OTHER",
] as const satisfies readonly ServiceType[];

const schema = z.object({
  customerName: z.string().min(2, "Informe o cliente"),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email("Informe um e-mail valido").optional().or(z.literal("")),
  title: z.string().min(3, "Informe o nome do servico"),
  serviceType: z.enum(serviceTypeOptions),
  address: z.string().min(5, "Informe o endereco"),
  scheduledStart: z.string().min(8, "Informe a data inicial"),
  scheduledEnd: z.string().optional(),
  revenue: z.coerce.number().min(0, "Informe um valor valido"),
  supervisorEmployeeId: z.string().optional(),
  description: z.string().optional(),
  clientNotes: z.string().optional(),
});

type ServiceOrderFormInput = z.input<typeof schema>;
type ServiceOrderForm = z.output<typeof schema>;
type ChecklistDraft = {
  id: string;
  title: string;
  description: string;
  isPriority: boolean;
  requiresPhoto: boolean;
};

function toLocalInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

export function NewServiceOrderView({ supervisors }: { supervisors: Employee[] }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [error, setError] = useState("");
  const [checklistDrafts, setChecklistDrafts] = useState<ChecklistDraft[]>([
    { id: "checklist-1", title: "", description: "", isPriority: false, requiresPhoto: false },
  ]);
  const allowed = canAccessAllServiceOrders(user?.role ?? "COLABORADOR");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceOrderFormInput, unknown, ServiceOrderForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      title: "",
      serviceType: "POST_CONSTRUCTION_CLEANING",
      address: "",
      scheduledStart: toLocalInputValue(),
      scheduledEnd: "",
      revenue: 0,
      supervisorEmployeeId: "",
      description: "",
      clientNotes: "",
    },
  });

  async function onSubmit(values: ServiceOrderForm) {
    setError("");
    const scheduledStart = toIsoDateTime(values.scheduledStart);
    const scheduledEnd = values.scheduledEnd ? toIsoDateTime(values.scheduledEnd) : scheduledStart;

    const response = await fetch("/api/service-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail,
        title: values.title,
        serviceType: values.serviceType,
        description: values.description,
        address: values.address,
        scheduledStart,
        scheduledEnd,
        status: "SCHEDULED",
        supervisorEmployeeId: values.supervisorEmployeeId || undefined,
        clientNotes: values.clientNotes,
        revenue: values.revenue,
        expenses: 0,
        checklistItems: checklistDrafts
          .filter((item) => item.title.trim())
          .map((item) => ({
            title: item.title.trim(),
            description: item.description,
            isPriority: item.isPriority,
            requiresPhoto: item.requiresPhoto,
            minimumPhotos: item.requiresPhoto ? 1 : 0,
            allowCollaboratorAction: true,
          })),
      }),
    });

    const data = await response.json().catch(() => null);
    if (response.status === 403) {
      setError("Seu perfil nao tem permissao para criar servicos.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel criar o servico.");
      return;
    }

    router.push(`/ordens-servico/${data.serviceOrder.id}`);
  }

  function updateChecklistDraft(id: string, input: Partial<ChecklistDraft>) {
    setChecklistDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...input } : item)));
  }

  function addChecklistDraft() {
    setChecklistDrafts((current) => [
      ...current,
      { id: `checklist-${Date.now()}`, title: "", description: "", isPriority: false, requiresPhoto: false },
    ]);
  }

  function removeChecklistDraft(id: string) {
    setChecklistDrafts((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
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
        <Button component={Link} href="/ordens-servico" startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
          Voltar
        </Button>
        <Alert severity="error">Apenas dono e gerente podem criar servicos.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
            Novo servico
          </Typography>
          <Typography color="text.secondary">
            Registre o servico fechado e depois monte a equipe na ordem de servico.
          </Typography>
        </Box>
        <Button component={Link} href="/ordens-servico" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit(onSubmit)}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Cliente
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
              <TextField label="Nome do cliente" {...register("customerName")} error={Boolean(errors.customerName)} helperText={errors.customerName?.message} />
              <TextField label="Telefone" {...register("customerPhone")} />
              <TextField label="E-mail" {...register("customerEmail")} error={Boolean(errors.customerEmail)} helperText={errors.customerEmail?.message} />
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Servico
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2 }}>
              <TextField label="Nome do servico" {...register("title")} error={Boolean(errors.title)} helperText={errors.title?.message} />
              <Controller
                control={control}
                name="serviceType"
                render={({ field }) => (
                  <TextField select label="Tipo de servico" {...field}>
                    {serviceTypeOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {labelFor(option)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField label="Endereco da obra" sx={{ gridColumn: { md: "1 / -1" } }} {...register("address")} error={Boolean(errors.address)} helperText={errors.address?.message} />
              <TextField label="Descricao do servico" multiline minRows={3} sx={{ gridColumn: { md: "1 / -1" } }} {...register("description")} />
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Planejamento
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              <TextField
                label="Inicio previsto"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                {...register("scheduledStart")}
                error={Boolean(errors.scheduledStart)}
                helperText={errors.scheduledStart?.message}
              />
              <TextField label="Fim previsto" type="datetime-local" InputLabelProps={{ shrink: true }} {...register("scheduledEnd")} />
              <TextField label="Valor fechado" type="number" {...register("revenue")} error={Boolean(errors.revenue)} helperText={errors.revenue?.message} />
              <Controller
                control={control}
                name="supervisorEmployeeId"
                render={({ field }) => (
                  <TextField select label="Supervisor" {...field}>
                    <MenuItem value="">Definir depois</MenuItem>
                    {supervisors.map((supervisor) => (
                      <MenuItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField label="Observacoes para o cliente" multiline minRows={3} sx={{ gridColumn: { md: "1 / -1" } }} {...register("clientNotes")} />
            </Box>
          </Box>

          <Box>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5} sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="h6">Checklist inicial</Typography>
                <Typography variant="body2" color="text.secondary">
                  Itens marcados como prioridade aparecem primeiro no checklist da OS.
                </Typography>
              </Box>
              <Button variant="outlined" onClick={addChecklistDraft}>
                Adicionar item
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {checklistDrafts.map((item, index) => (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack spacing={1.2}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 2fr" }, gap: 1.5 }}>
                      <TextField
                        label={`Item ${index + 1}`}
                        value={item.title}
                        onChange={(event) => updateChecklistDraft(item.id, { title: event.target.value })}
                        size="small"
                      />
                      <TextField
                        label="Detalhes"
                        value={item.description}
                        onChange={(event) => updateChecklistDraft(item.id, { description: event.target.value })}
                        size="small"
                      />
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                        <FormControlLabel
                          control={<Checkbox checked={item.isPriority} onChange={(event) => updateChecklistDraft(item.id, { isPriority: event.target.checked })} />}
                          label="Prioridade"
                        />
                        <FormControlLabel
                          control={<Checkbox checked={item.requiresPhoto} onChange={(event) => updateChecklistDraft(item.id, { requiresPhoto: event.target.checked })} />}
                          label="Exigir foto"
                        />
                      </Stack>
                      <Button color="warning" variant="text" onClick={() => removeChecklistDraft(item.id)} disabled={checklistDrafts.length === 1}>
                        Remover
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="flex-end">
            <Button component={Link} href="/ordens-servico" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={isSubmitting}>
              Criar servico
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
