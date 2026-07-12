"use client";

import { useMemo, useState } from "react";
import { Box, Chip, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type { Employee, ScheduleEvent, ServiceOrder, ServiceOrderChecklistItem, ServiceOrderMaterial } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const viewLabels = ["Dia", "Semana", "Mes"];
const eventTypes = ["", "INSPECTION", "SERVICE_ORDER", "MATERIAL_PREPARATION", "EQUIPMENT_RETURN", "AFTER_SALES", "INTERNAL_TASK"];

export function ScheduleView({
  employees,
  scheduleEvents,
  serviceOrderChecklistItems,
  serviceOrderMaterials,
  serviceOrders,
  referenceTime,
}: {
  employees: Employee[];
  scheduleEvents: ScheduleEvent[];
  serviceOrderChecklistItems: ServiceOrderChecklistItem[];
  serviceOrderMaterials: ServiceOrderMaterial[];
  serviceOrders: ServiceOrder[];
  referenceTime: string;
}) {
  const [view, setView] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [smartFilter, setSmartFilter] = useState("");

  const supervisorOptions = employees.filter((employee) => serviceOrders.some((order) => order.supervisorEmployeeId === employee.id));

  const filteredEvents = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return scheduleEvents.filter((event) => {
      const order = event.serviceOrderId ? serviceOrders.find((item) => item.id === event.serviceOrderId) : undefined;
      const checklistPending = order
        ? serviceOrderChecklistItems.some((item) => item.serviceOrderId === order.id && item.status !== "DONE")
        : false;
      const materialPending = order
        ? serviceOrderMaterials.some((item) => item.serviceOrderId === order.id && item.status !== "DELIVERED_TO_TEAM")
        : false;
      const overdue = order ? new Date(order.scheduledEnd).getTime() < new Date(referenceTime).getTime() && !["DONE", "DELIVERED"].includes(order.status) : false;

      const matchesQuery =
        !normalizedQuery ||
        [event.title, event.description, order?.customerName ?? "", order?.title ?? ""].some((value) =>
          normalizeText(value).includes(normalizedQuery),
        );
      const matchesType = !type || event.type === type;
      const matchesStatus = !status || event.status === status;
      const matchesSupervisor = !supervisor || order?.supervisorEmployeeId === supervisor;
      const matchesSmart =
        !smartFilter ||
        (smartFilter === "materials" && materialPending) ||
        (smartFilter === "delayed" && (event.status === "DELAYED" || overdue)) ||
        (smartFilter === "checklist" && checklistPending) ||
        (smartFilter === "photos" && checklistPending);

      return matchesQuery && matchesType && matchesStatus && matchesSupervisor && matchesSmart;
    });
  }, [query, referenceTime, scheduleEvents, serviceOrderChecklistItems, serviceOrderMaterials, serviceOrders, smartFilter, status, supervisor, type]);

  const delayedCount = filteredEvents.filter((event) => event.status === "DELAYED").length;
  const materialPendingCount = serviceOrderMaterials.filter((item) => item.status === "PENDING_SEPARATION" || item.status === "SEPARATING").length;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Agenda inteligente
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Eventos de vistoria, servicos, materiais, equipamentos, garantia, pos-venda e tarefas internas com alertas operacionais.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<WarningAmberRoundedIcon />} color={delayedCount ? "warning" : "success"} label={`${delayedCount} atrasados`} />
          <Chip icon={<Inventory2RoundedIcon />} color="warning" label={`${materialPendingCount} materiais pendentes`} />
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <Tabs value={view} onChange={(_, value: number) => setView(value)} variant="scrollable" scrollButtons="auto">
            {viewLabels.map((label) => (
              <Tab key={label} icon={<CalendarMonthRoundedIcon />} iconPosition="start" label={label} />
            ))}
          </Tabs>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr repeat(4, minmax(160px, 1fr))" }, gap: 1.2 }}>
            <TextField size="small" placeholder="Buscar evento, cliente ou OS" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select size="small" value={type} onChange={(event) => setType(event.target.value)} displayEmpty>
              <MenuItem value="">Tipo</MenuItem>
              {eventTypes.filter(Boolean).map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} displayEmpty>
              <MenuItem value="">Status</MenuItem>
              {["SCHEDULED", "IN_PROGRESS", "DONE", "CANCELED", "DELAYED"].map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={supervisor} onChange={(event) => setSupervisor(event.target.value)} displayEmpty>
              <MenuItem value="">Supervisor</MenuItem>
              {supervisorOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={smartFilter} onChange={(event) => setSmartFilter(event.target.value)} displayEmpty>
              <MenuItem value="">Filtro inteligente</MenuItem>
              <MenuItem value="materials">Materiais pendentes</MenuItem>
              <MenuItem value="delayed">Obras atrasadas</MenuItem>
              <MenuItem value="checklist">Checklist incompleto</MenuItem>
              <MenuItem value="photos">Sem fotos finais</MenuItem>
            </Select>
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "0.7fr 1.3fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Atividades do {viewLabels[view].toLowerCase()}
          </Typography>
          <Stack spacing={1.3}>
            {filteredEvents.slice(0, 8).map((event) => (
              <Box key={event.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.default" }}>
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  {event.type === "SERVICE_ORDER" ? <ConstructionRoundedIcon color="primary" /> : <CalendarMonthRoundedIcon color="action" />}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={900}>{event.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(event.startsAt)} - {labelFor(event.type)}
                    </Typography>
                  </Box>
                  <StatusChip value={event.status} />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Linha operacional
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {filteredEvents.map((event) => {
              const order = event.serviceOrderId ? serviceOrders.find((item) => item.id === event.serviceOrderId) : undefined;
              return (
                <Paper key={event.id} variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography fontWeight={900}>{event.title}</Typography>
                      <Chip size="small" label={event.priority} color={event.priority === "URGENT" ? "warning" : "default"} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {event.description}
                    </Typography>
                    {order && (
                      <Typography variant="body2" fontWeight={800}>
                        {order.customerName}
                      </Typography>
                    )}
                    <StatusChip value={event.status} />
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}
