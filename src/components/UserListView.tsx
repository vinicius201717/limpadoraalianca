"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { formatDateTime } from "@/lib/format";
import type { Employee, SessionUser, UserRole } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const roleOptions: UserRole[] = [
  "GERENTE",
  "SUPERVISOR_OBRA",
  "ALMOXARIFADO",
  "COMERCIAL",
  "TECNICO",
  "FINANCEIRO",
  "COLABORADOR",
];

type UserRow = SessionUser & {
  lastLoginAt?: string;
  createdAt?: string;
};

export function UserListView({ users, employees }: { users: UserRow[]; employees: Employee[] }) {
  const [rows, setRows] = useState<UserRow[]>(
    users.map((user) => ({
      ...user,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt ?? "2026-06-01T08:00:00",
    })),
  );
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const linkedEmployeeByUserId = useMemo(
    () => new Map(employees.filter((employee) => employee.userId).map((employee) => [employee.userId, employee.name])),
    [employees],
  );

  async function setActive(userId: string, active: boolean) {
    setNotice("");
    setError("");
    const response = await fetch(`/api/users/${userId}/${active ? "activate" : "deactivate"}`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar usuario.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === userId ? { ...row, isActive: active } : row)));
    setNotice(data?.message ?? "Usuario atualizado com sucesso.");
  }

  async function changeRole(userId: string, role: UserRole) {
    setNotice("");
    setError("");
    const response = await fetch(`/api/users/${userId}/change-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel alterar perfil.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === userId ? { ...row, role } : row)));
    setNotice(data?.message ?? "Perfil alterado com sucesso.");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Usuarios
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Acessos ao sistema, papeis, status, ultimo acesso e vinculo com colaboradores.
          </Typography>
        </Box>
        <Button component={Link} href="/usuarios/novo" variant="contained" startIcon={<AddRoundedIcon />}>
          Novo usuario
        </Button>
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Colaborador vinculado</TableCell>
              <TableCell>Ultimo acesso</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell align="right">Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const draftRole = roleDrafts[row.id] ?? row.role;
              const isProtectedOwner = row.role === "OWNER";
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography fontWeight={850}>{row.name}</Typography>
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <StatusChip value={row.role} />
                  </TableCell>
                  <TableCell>
                    <Chip color={row.isActive ? "success" : "default"} label={row.isActive ? "Ativo" : "Inativo"} />
                  </TableCell>
                  <TableCell>{linkedEmployeeByUserId.get(row.id) ?? "Sem vinculo"}</TableCell>
                  <TableCell>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Nunca acessou"}</TableCell>
                  <TableCell>{row.createdAt ? formatDateTime(row.createdAt) : "-"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {!isProtectedOwner && (
                        <Select
                          value={draftRole}
                          size="small"
                          onChange={(event) => setRoleDrafts((current) => ({ ...current, [row.id]: event.target.value as UserRole }))}
                          sx={{ minWidth: 180 }}
                        >
                          {roleOptions.map((role) => (
                            <MenuItem key={role} value={role}>
                              {role}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                      {!isProtectedOwner && (
                        <Button size="small" variant="outlined" onClick={() => changeRole(row.id, draftRole)}>
                          Alterar role
                        </Button>
                      )}
                      {!isProtectedOwner && (
                        <Button size="small" color={row.isActive ? "warning" : "success"} onClick={() => setActive(row.id, !row.isActive)}>
                          {row.isActive ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
