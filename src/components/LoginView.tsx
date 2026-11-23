"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";

const loginSchema = z.object({
  login: z.string().min(8, "Informe o telefone com DDD"),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginView() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Não foi possível entrar. Tente novamente.");
      return;
    }

    router.push(data.user?.mustChangePassword ? "/configuracoes" : "/dashboard");
    router.refresh();
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1fr 460px" },
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          alignItems: "flex-end",
          p: 6,
          bgcolor: "#0f2169",
          color: "white",
          backgroundImage:
            "linear-gradient(135deg, rgba(15,33,105,.96), rgba(9,168,229,.72) 54%, rgba(37,199,131,.52)), repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0, rgba(255,255,255,.08) 1px, transparent 1px, transparent 84px)",
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 720 }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,.76)", fontWeight: 800 }}>
            Aliança Limpeza e Restauração
          </Typography>
          <Typography variant="h2" sx={{ fontSize: 56, lineHeight: 1 }}>
            Limpeza e restauração com controle total da operação.
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,.78)", fontSize: 18 }}>
            Leads, vistorias, orçamentos, ordens de serviço, equipe, avaliações e estoque em um painel responsivo.
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", p: { xs: 2, sm: 4 } }}>
        <Paper variant="outlined" sx={{ width: "100%", maxWidth: 430, p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
          <Stack spacing={2.4}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: 2,
                  bgcolor: "common.white",
                  border: 1,
                  borderColor: "divider",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <Box component="img" src="/logo-alianca.png" alt="Aliança Limpeza e Restauração" sx={{ width: 50, height: 50, objectFit: "contain" }} />
              </Box>
              <Box>
                <Typography variant="h5">Entrar</Typography>
                <Typography variant="body2" color="text.secondary">
                  Aliança Limpeza e Restauração
                </Typography>
              </Box>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            <Stack component="form" spacing={2} onSubmit={handleSubmit(onSubmit)}>
              <TextField
                label="Telefone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="62999999999"
                {...register("login")}
                error={Boolean(errors.login)}
                helperText={errors.login?.message}
              />
              <TextField
                label="Senha"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
              />
              <Button type="submit" variant="contained" size="large" startIcon={<LoginRoundedIcon />} disabled={isSubmitting}>
                Acessar sistema
              </Button>
            </Stack>

          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
