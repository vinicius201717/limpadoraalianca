"use client";

import Link from "next/link";
import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { labelFor, labelKey } from "@/lib/labels";
import type { ModuleConfig } from "@/lib/module-config";
import { StatusChip } from "./StatusChip";

function prettyValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (typeof value === "number" && value > 1000) return formatCurrency(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (Array.isArray(value)) return value.map((item) => labelFor(item)).join(", ");
  if (typeof value === "string" && (/^[A-Z0-9_]+$/.test(value) || value === "true" || value === "false")) return labelFor(value);
  return String(value);
}

export function RecordDetailView({ config, record }: { config: ModuleConfig; record: Record<string, unknown> }) {
  const title = String(record.name ?? record.title ?? record.customerName ?? record.id);

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }} noWrap>
            {title}
          </Typography>
          <Typography color="text.secondary">{config.subtitle}</Typography>
        </Box>
        <Button component={Link} href={`/${config.key}`} startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Registro
              </Typography>
              <Typography variant="h6">{record.id as string}</Typography>
            </Box>
            {record.status != null && <StatusChip value={record.status} />}
          </Stack>

          <Divider />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(3, 1fr)" }, gap: 2 }}>
            {Object.entries(record)
              .filter(([key]) => key !== "id")
              .map(([key, value]) => (
                <Box key={key}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                    {labelKey(key)}
                  </Typography>
                  <Typography fontWeight={750} sx={{ wordBreak: "break-word" }}>
                    {prettyValue(value)}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
