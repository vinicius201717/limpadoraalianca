"use client";
import Link from "next/link";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { canUseWhatsApp } from "@/lib/whatsapp-schema";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";

import { labelFor } from "@/lib/labels";
import type { SessionUser } from "@/lib/types";

function displayEmail(email?: string) {
  if (!email) return "-";
  return email.endsWith("@telefone.alianca.local") ? "-" : email;
}

export function SettingsSecurityView({ user }: { user: SessionUser }) {
  const [profileUser, setProfileUser] = useState(user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  async function updateProfilePhoto(avatarUrl: string) {
    setNotice("");
    setError("");
    setAvatarSaving(true);
    const response = await fetch("/api/auth/profile-photo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl }),
    });
    const data = await response.json().catch(() => null);
    setAvatarSaving(false);

    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar a foto.");
      return;
    }

    setProfileUser(data.user);
    window.dispatchEvent(new CustomEvent("alianca:user-updated", { detail: { user: data.user } }));
    setNotice(avatarUrl ? "Foto de perfil atualizada." : "Foto de perfil removida.");
  }

  async function handleProfilePhotoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 1_500_000) {
      setError("Use uma foto de ate 1,5 MB.");
      return;
    }
    await updateProfilePhoto(await readFileAsDataUrl(file));
  }

  async function submitPasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (newPassword.length < 10) {
      setError("A nova senha deve ter pelo menos 10 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmacao nao confere com a nova senha.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar a senha.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice("Senha atualizada com sucesso.");
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.7 }}>
          Configuracoes
        </Typography>
        <Typography color="text.secondary">Seguranca do acesso e dados principais do seu perfil.</Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar src={profileUser.avatarUrl} sx={{ width: 58, height: 58, bgcolor: "primary.main", fontSize: 24 }}>
                {profileUser.name.slice(0, 1)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {profileUser.name}
                </Typography>
                <Chip size="small" color="primary" variant="outlined" label={labelFor(profileUser.role)} />
              </Box>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {canUseWhatsApp(profileUser.role) && <Button component={Link} href="/assistente-whatsapp" color="success" variant="outlined" startIcon={<WhatsAppIcon />}>Assistente WhatsApp</Button>}
              <Button component="label" variant="outlined" startIcon={<CameraAltRoundedIcon />} disabled={avatarSaving}>
                {avatarSaving ? "Salvando..." : "Trocar foto"}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void handleProfilePhotoFile(event.target.files);
                    event.target.value = "";
                  }}
                />
              </Button>
              <Button
                variant="text"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={avatarSaving || !profileUser.avatarUrl}
                onClick={() => void updateProfilePhoto("")}
              >
                Remover foto
              </Button>
            </Stack>
            <Divider />
            <Info label="Telefone de login" value={profileUser.phone ?? "-"} />
            <Info label="E-mail" value={displayEmail(profileUser.email)} />
            <Info label="Acesso financeiro" value={profileUser.role === "OWNER" || profileUser.role === "FINANCEIRO" || profileUser.canViewFinancials ? "Liberado" : "Restrito"} />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack component="form" spacing={2} onSubmit={submitPasswordChange}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SecurityRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">Trocar senha</Typography>
                <Typography variant="body2" color="text.secondary">
                  Atualize sua senha de acesso neste dispositivo.
                </Typography>
              </Box>
            </Stack>

            {notice && <Alert severity="success">{notice}</Alert>}
            {error && <Alert severity="warning">{error}</Alert>}

            <TextField
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              startIcon={<LockResetRoundedIcon />}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              sx={{ alignSelf: "flex-start" }}
            >
              {saving ? "Atualizando..." : "Alterar senha"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={850} sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}
