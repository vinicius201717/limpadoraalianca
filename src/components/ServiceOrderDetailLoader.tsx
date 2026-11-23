"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { ServiceOrderDetailView } from "./ServiceOrderDetailView";

type ServiceOrderDetailData = ComponentProps<typeof ServiceOrderDetailView>;

async function requestServiceOrderDetail(orderId: string) {
  try {
    const response = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}/detail`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        detail: null,
        error: data?.message ?? "Nao foi possivel carregar esta ordem de servico.",
      };
    }

    return { detail: data.detail as ServiceOrderDetailData, error: "" };
  } catch {
    return { detail: null, error: "Falha de conexao ao carregar esta ordem de servico." };
  }
}

export function ServiceOrderDetailLoader({ orderId }: { orderId: string }) {
  const [detail, setDetail] = useState<ServiceOrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await requestServiceOrderDetail(orderId);
    setDetail(result.detail);
    setError(result.error);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    let mounted = true;

    requestServiceOrderDetail(orderId).then((result) => {
      if (!mounted) return;
      setDetail(result.detail);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Carregando ordem de servico
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Buscando a OS atualizada no sistema.
            </Typography>
          </Box>
          <LinearProgress sx={{ height: 8, borderRadius: 999 }} />
        </Stack>
      </Paper>
    );
  }

  if (error || !detail) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Alert severity="warning" sx={{ width: "100%" }}>
            {error || "Ordem de servico nao encontrada."}
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void loadDetail()}>
              Tentar novamente
            </Button>
            <Button component={Link} href="/ordens-servico" startIcon={<ArrowBackRoundedIcon />}>
              Voltar para OS
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return <ServiceOrderDetailView {...detail} />;
}
