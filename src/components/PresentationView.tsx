"use client";

import Link from "next/link";
import { Avatar, Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

const benefits = [
  "Menos servico perdido por falta de follow-up.",
  "Menos retrabalho porque checklist, fotos e avaliacao ficam vinculados a OS.",
  "Mais controle sobre margem, materiais e desempenho da equipe.",
  "Mais confianca para vender servicos premium com historico visual e garantia.",
];

const flow = ["Lead", "Vistoria", "Orcamento", "OS", "Fotos", "Avaliacao", "Garantia"];

const sections = [
  {
    title: "Problema atual",
    icon: <WarningAmberRoundedIcon />,
    text: "A operacao depende de conversas, memoria e planilhas soltas. Isso cria atraso em retorno comercial, perda de informacao da obra, dificuldade para medir equipe e pouca previsibilidade de lucro.",
  },
  {
    title: "Solucao proposta",
    icon: <AssignmentTurnedInRoundedIcon />,
    text: "Centralizar clientes, leads, orcamentos, ordens de servico, fotos, checklist, equipe, financeiro e avaliacoes em um unico sistema interno, com permissao por perfil.",
  },
  {
    title: "Gestao dos colaboradores",
    icon: <GroupsRoundedIcon />,
    text: "Cada colaborador passa a ter historico de obras, media geral, media por criterio, pontos fortes, pontos a melhorar e alerta de treinamento. A empresa deixa de decidir por percepcao e passa a decidir por dados.",
  },
  {
    title: "Controle de obras",
    icon: <TimelineRoundedIcon />,
    text: "Cada OS mostra resumo, cliente, equipe, checklist, fotos, financeiro, avaliacao da equipe e historico. O dono consegue enxergar andamento, atraso, pendencias e qualidade de entrega.",
  },
  {
    title: "Controle financeiro",
    icon: <PaidRoundedIcon />,
    text: "A receita e as despesas ficam associadas a obra, permitindo acompanhar margem estimada, priorizar servicos mais lucrativos e reduzir vazamentos pequenos que corroem o resultado.",
  },
  {
    title: "Garantia e pos-venda",
    icon: <ShieldRoundedIcon />,
    text: "Fotos antes/depois, termos de garantia e historico de atendimento fortalecem a relacao com clientes de alto padrao e ajudam a vender manutencoes recorrentes.",
  },
];

export function PresentationView() {
  return (
    <Stack spacing={3}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 4 },
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems={{ lg: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip color="primary" label="Apresentacao interna" sx={{ mb: 2 }} />
            <Typography variant="h3" sx={{ fontSize: { xs: 34, md: 48 }, maxWidth: 920 }}>
              Sistema de gestao para restauracao de pisos e limpeza pos-obra
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 820, fontSize: 17 }}>
              Uma plataforma para o dono enxergar comercial, obra, equipe, financeiro, fotos e pos-venda no mesmo fluxo,
              com dados suficientes para vender melhor e executar com menos perda.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
              <Chip icon={<CheckCircleRoundedIcon />} label="Dashboard executivo" />
              <Chip icon={<GroupsRoundedIcon />} label="Equipe avaliada" />
              <Chip icon={<PaidRoundedIcon />} label="Margem por obra" />
              <Chip icon={<CameraAltRoundedIcon />} label="Fotos antes/depois" />
            </Stack>
          </Box>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, width: { xs: "100%", lg: 380 }, bgcolor: "background.default" }}>
            <Stack spacing={2}>
              <MiniMetric label="Receita estimada do mes" value="R$ 202,9 mil" />
              <MiniMetric label="OS em execucao" value="3" />
              <MiniMetric label="Media da equipe" value="4,5" />
              <MiniMetric label="Pendencias criticas" value="4" tone="warning" />
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Fluxo da operacao
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(7, minmax(0, 1fr))" }, gap: 1.5 }}>
          {flow.map((item, index) => (
            <Box key={item} sx={{ p: 1.6, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.default" }}>
              <Typography variant="caption" color="text.secondary">
                Etapa {index + 1}
              </Typography>
              <Typography fontWeight={900}>{item}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {sections.map((section) => (
          <Paper key={section.title} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
                {section.icon}
              </Avatar>
              <Box>
                <Typography variant="h6">{section.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.7 }}>
                  {section.text}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Avatar variant="rounded" sx={{ bgcolor: "success.light", color: "success.dark" }}>
              <TrendingUpRoundedIcon />
            </Avatar>
            <Box>
              <Typography variant="h5">Por que aumenta lucro e organizacao</Typography>
              <Typography color="text.secondary">O sistema reduz pontos cegos que normalmente viram desconto, retrabalho ou perda de venda.</Typography>
            </Box>
          </Stack>
          <Stack spacing={1.3}>
            {benefits.map((benefit) => (
              <Stack key={benefit} direction="row" spacing={1} alignItems="flex-start">
                <CheckCircleRoundedIcon color="success" fontSize="small" />
                <Typography>{benefit}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Fotos antes/depois
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <PhotoStage label="Antes" description="Riscos, manchas, residuos e pontos de atencao documentados na entrada." />
            <PhotoStage label="Depois" description="Entrega, brilho, limpeza fina e evidencia visual para garantia e pos-venda." done />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography color="text.secondary">
            Para clientes de alto padrao, a foto bem organizada e parte da venda: prova cuidado, reduz discussao e facilita manutencao futura.
          </Typography>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ md: "center" }}>
          <Box>
            <Typography variant="h5">Demonstracao pronta para o dono</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6 }}>
              A base mostra clientes premium, obras reais de limpeza pos-obra, restauracao, polimento, impermeabilizacao e avaliacao de equipe.
            </Typography>
          </Box>
          <Button component={Link} href="/dashboard" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
            Abrir dashboard
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function MiniMetric({ label, value, tone = "primary" }: { label: string; value: string; tone?: "primary" | "warning" }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={850}>
        {label}
      </Typography>
      <Typography variant="h5" color={`${tone}.main`}>
        {value}
      </Typography>
    </Box>
  );
}

function PhotoStage({ label, description, done = false }: { label: string; description: string; done?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      <Box
        sx={{
          minHeight: 170,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: done ? "success.light" : "action.hover",
        }}
      >
        <CameraAltRoundedIcon sx={{ fontSize: 46, color: done ? "common.white" : "text.secondary" }} />
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
