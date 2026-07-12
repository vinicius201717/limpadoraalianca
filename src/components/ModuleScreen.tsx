"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";

import { formatCurrency, formatDate, formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type { ModuleColumn, ModuleConfig } from "@/lib/module-config";
import { StatusChip } from "./StatusChip";

function formatCell(value: unknown, column: ModuleColumn) {
  if (value == null || value === "") return "-";
  if (column.format === "currency") return formatCurrency(Number(value));
  if (column.format === "date") return formatDate(String(value));
  if (column.format === "datetime") return formatDateTime(String(value));
  if (column.format === "rating") {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <StarRoundedIcon fontSize="small" color="secondary" />
        <Typography variant="body2" fontWeight={800}>
          {Number(value).toFixed(1)}
        </Typography>
      </Stack>
    );
  }
  if (column.format === "status") return <StatusChip value={value} />;
  if (column.format === "number") return new Intl.NumberFormat("pt-BR").format(Number(value));
  return String(value);
}

export function ModuleScreen({ config }: { config: ModuleConfig }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return config.rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        Object.values(row).some((value) => normalizeText(String(value ?? "")).includes(normalizedQuery));

      const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);

      return matchesQuery && matchesFilters;
    });
  }, [config.rows, filters, query]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            {config.title}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            {config.subtitle}
          </Typography>
        </Box>

        {config.newPath && (
          <Button component={Link} href={config.newPath} variant="contained" startIcon={<AddRoundedIcon />}>
            Novo
          </Button>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
          <TextField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={config.searchPlaceholder}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {config.filters?.map((filter) => (
            <Select
              key={filter.key}
              value={filters[filter.key] ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
              displayEmpty
              size="small"
              sx={{ minWidth: { xs: "100%", lg: 190 } }}
            >
              <MenuItem value="">{filter.label}</MenuItem>
              {filter.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </Select>
          ))}

          <Chip label={`${filteredRows.length} registros`} sx={{ alignSelf: { xs: "flex-start", lg: "center" } }} />
        </Stack>
      </Paper>

      {filteredRows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
          <Typography variant="h6">{config.emptyTitle}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Ajuste os filtros ou a busca para ampliar o resultado.
          </Typography>
        </Paper>
      ) : isDesktop ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                {config.columns.map((column) => (
                  <TableCell key={column.key} sx={{ fontWeight: 800, color: "text.secondary" }}>
                    {column.label}
                  </TableCell>
                ))}
                {config.detailBasePath && <TableCell align="right" sx={{ fontWeight: 800 }}>Detalhe</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={String(row.id)} hover>
                  {config.columns.map((column) => (
                    <TableCell key={column.key}>{formatCell(row[column.key], column)}</TableCell>
                  ))}
                  {config.detailBasePath && (
                    <TableCell align="right">
                      <Button
                        component={Link}
                        href={`${config.detailBasePath}/${String(row.id)}`}
                        size="small"
                        endIcon={<ArrowForwardRoundedIcon />}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1.5}>
          {filteredRows.map((row) => (
            <Paper key={String(row.id)} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1.3}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={850} noWrap>
                      {String(row[config.columns[0].key] ?? row.id)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {String(row.id)}
                    </Typography>
                  </Box>
                  {config.detailBasePath && (
                    <Button component={Link} href={`${config.detailBasePath}/${String(row.id)}`} size="small">
                      Abrir
                    </Button>
                  )}
                </Stack>

                <Divider />

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.2 }}>
                  {config.columns.slice(1).map((column) => (
                    <Box key={column.key} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        {column.label}
                      </Typography>
                      <Box sx={{ mt: 0.4 }}>{formatCell(row[column.key], column)}</Box>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
