"use client";

import { IconButton, InputAdornment } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

type LoginResult = {
  user?: { mustChangePassword?: boolean };
  message?: string;
};

export function FieldLoginView({ changePassword = false }: { changePassword?: boolean }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    // The installed PWA opens this same page whether the employee has a session or not.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/campo-sw.js", { scope: "/campo" }).catch(() => {});
    }
    const check = () => setInstallable(window.matchMedia("(display-mode: standalone)").matches);
    check();
    const change = window.matchMedia("(display-mode: standalone)");
    change.addEventListener?.("change", check);
    return () => change.removeEventListener?.("change", check);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !login.trim() || password.length < 4) return;
    setError(""); setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
        credentials: "same-origin", cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as LoginResult;
      if (!response.ok) throw new Error(result.message || "Não foi possível entrar. Confira os dados.");
      setPassword("");
      // Keep navigation inside the PWA scope, not in the complete management system.
      window.location.replace("/campo");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na autenticação.");
    } finally { setPending(false); }
  }

  return (
    <Box component="main" sx={{
      position: "fixed", inset: 0, minHeight: "100dvh", display: "grid", placeItems: "center",
      overflow: "hidden", bgcolor: "#071728", color: "#f5fff9", px: 2,
    }}>
      <Box sx={{
        width: "100%", maxWidth: 420, bgcolor: "#0e2841", p: { xs: 3, sm: 4 },
        borderRadius: 4, border: "1px solid #315064", boxShadow: "0 20px 75px rgba(0,0,0,.35)",
      }}>
        <Stack spacing={2.4}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "#145743" }}>
              <MicRoundedIcon sx={{ fontSize: 30, color: "#c2f2db" }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={850}>Aliança Campo</Typography>
              <Typography variant="body2" sx={{ color: "#a8c6d3" }}>Diário de obras e registros</Typography>
            </Box>
          </Box>
          {changePassword ? (
            <>
              <Alert severity="warning">Sua conta exige troca de senha antes de usar o Assistente de Campo.</Alert>
              <Button href="/configuracoes" target="_blank" rel="noopener noreferrer" variant="contained" color="success" endIcon={<OpenInNewRoundedIcon />}>
                Abrir configurações de segurança
              </Button>
              <Typography variant="caption" sx={{ color: "#b1c9d4" }}>Após trocar a senha, volte a esta tela e atualize.</Typography>
              <Button variant="outlined" sx={{ color: "#e0eeef", borderColor: "#62808c" }} onClick={() => window.location.reload()}>Atualizar</Button>
            </>
          ) : (
            <>
              <Typography sx={{ color: "#c2d4de", fontSize: 14 }}>
                Entre com o usuário da Aliança. Cada mensagem, áudio, foto e vídeo ficará registrado na sua conta e na obra selecionada.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              <Box component="form" onSubmit={(event) => void signIn(event)}>
                <Stack spacing={2}>
                  <TextField
                    label="Telefone com DDD ou e-mail"
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    autoComplete="username" autoFocus required fullWidth
                    inputProps={{ maxLength: 120 }}
                    sx={{ "& .MuiInputBase-root": { bgcolor: "#eef8ff" } }}
                  />
                  <TextField
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword((visible) => !visible)}
                            onMouseDown={(event) => event.preventDefault()}
                            type="button"
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password" required fullWidth inputProps={{ maxLength: 128 }}
                    sx={{ "& .MuiInputBase-root": { bgcolor: "#eef8ff" } }}
                  />
                  <Button type="submit" variant="contained" color="success" size="large" disabled={pending || !login.trim() || password.length < 4}
                    startIcon={pending ? <CircularProgress size={18} color="inherit" /> : <LockOutlinedIcon />}
                    sx={{ py: 1.45, fontWeight: 850, borderRadius: 3 }}>
                    {pending ? "Entrando..." : "Entrar no Assistente de Campo"}
                  </Button>
                </Stack>
              </Box>
              <Typography variant="caption" sx={{ color: "#aac1c7", textAlign: "center" }}>
                {installable ? "Você está usando o aplicativo instalado." : "No celular, instale o Aliança Campo na tela inicial para acessar esta página como aplicativo."}
              </Typography>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
