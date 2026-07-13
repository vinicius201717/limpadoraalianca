"use client";

import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  GlobalStyles,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import LocalPhoneRoundedIcon from "@mui/icons-material/LocalPhoneRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";

import type { SiteBeforeAfter, SiteTestimonial } from "@/lib/types";

const heroImage = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=88";
const detailImage = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=84";

const serviceShowcase = [
  {
    title: "Limpeza pós-obra premium",
    short: "Entrega fina para imóvel pronto para morar.",
    metric: "72h",
    metricLabel: "operação rápida",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=82",
    color: "#09a8e5",
  },
  {
    title: "Restauração de mármore",
    short: "Recuperação de brilho, manchas e micro riscos.",
    metric: "6 etapas",
    metricLabel: "processo técnico",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82",
    color: "#25c783",
  },
  {
    title: "Polimento de granito",
    short: "Acabamento uniforme para áreas de alto tráfego.",
    metric: "alto brilho",
    metricLabel: "acabamento final",
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82",
    color: "#0f2169",
  },
  {
    title: "Impermeabilização",
    short: "Proteção contra absorção, manchas e desgaste.",
    metric: "proteção",
    metricLabel: "pós-venda",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82",
    color: "#0b789b",
  },
  {
    title: "Cristalização",
    short: "Brilho espelhado com método controlado.",
    metric: "premium",
    metricLabel: "acabamento",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82",
    color: "#2f80ed",
  },
  {
    title: "Limpeza fina para entrega",
    short: "Detalhamento de vidro, metais, rejuntes e cantos.",
    metric: "vistoria",
    metricLabel: "final",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=82",
    color: "#19b89b",
  },
];

const services = serviceShowcase.map((service) => service.title);

const businessLocation = {
  address: "Avenida Bela Vista, 957 - Jardim Bela Vista - Goiânia/GO",
  cep: "CEP: 74912-261",
  coverage: "Atendemos Goiânia e região metropolitana",
  query: "Avenida Bela Vista, 957 - Jardim Bela Vista, Goiânia - GO, 74912-261",
  hours: ["Segunda a sexta, 8h às 18h", "Sábado, 8h às 13h"],
};

const encodedLocationQuery = encodeURIComponent(businessLocation.query);
const mapsEmbedUrl = `https://www.google.com/maps?q=${encodedLocationQuery}&output=embed`;
const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocationQuery}`;

const heroStats = [
  ["7300+", "limpezas realizadas"],
  ["9000+", "pisos restaurados"],
  ["20 anos", "de experiência"],
  ["Goiânia", "e região metropolitana"],
];

const processSteps = [
  {
    title: "Diagnóstico técnico",
    text: "A equipe identifica tipo de piso, riscos, manchas, áreas sensíveis e prazo ideal antes de executar.",
    icon: <QueryStatsRoundedIcon />,
  },
  {
    title: "Proteção do imóvel",
    text: "Metais, rodapés, marcenaria, elevadores e móveis recebem proteção antes do produto ou máquina entrar.",
    icon: <ShieldRoundedIcon />,
  },
  {
    title: "Execução por checklist",
    text: "Cada etapa é acompanhada por tarefas, fotos, equipe responsável e validação de entrega.",
    icon: <AssignmentTurnedInRoundedIcon />,
  },
  {
    title: "Entrega e pós-venda",
    text: "O cliente recebe orientação de conservação, fotos de resultado e segurança para garantia.",
    icon: <WorkspacePremiumRoundedIcon />,
  },
];

const commercialBlocks = [
  {
    title: "Para residências de alto padrão",
    text: "Acabamento cuidadoso para apartamentos, casas, halls sociais, áreas gourmet e imóveis recém-entregues.",
    icon: <WorkspacePremiumRoundedIcon />,
  },
  {
    title: "Para construtoras e arquitetos",
    text: "Limpeza fina antes da vistoria, organização de prazos e registro visual para reduzir retrabalho.",
    icon: <ConstructionRoundedIcon />,
  },
  {
    title: "Para condomínios",
    text: "Restauração de áreas comuns sem perder controle de circulação, proteção e comunicação com moradores.",
    icon: <GroupsRoundedIcon />,
  },
];

const orbitItems = [
  "Garantia",
  "Fotos",
  "Checklist",
  "Equipe",
  "Produtos",
  "Pós-venda",
];

const bubbles = [
  { size: 18, delay: -1, duration: 18, driftX: 7, sway: 2.2, opacity: 0.3 },
  { size: 34, delay: -6, duration: 23, driftX: 18, sway: -3.4, opacity: 0.24 },
  { size: 58, delay: -12, duration: 29, driftX: 33, sway: 4.8, opacity: 0.2 },
  { size: 26, delay: -17, duration: 21, driftX: 49, sway: -4.2, opacity: 0.27 },
  { size: 76, delay: -23, duration: 34, driftX: 62, sway: 5.4, opacity: 0.16 },
  { size: 42, delay: -8, duration: 26, driftX: 76, sway: -6.2, opacity: 0.22 },
  { size: 22, delay: -15, duration: 20, driftX: 88, sway: 3.5, opacity: 0.28 },
  { size: 94, delay: -31, duration: 38, driftX: 44, sway: -7.4, opacity: 0.14 },
  { size: 48, delay: -27, duration: 31, driftX: 25, sway: 6.1, opacity: 0.19 },
  { size: 30, delay: -4, duration: 22, driftX: 55, sway: 2.8, opacity: 0.25 },
  { size: 64, delay: -20, duration: 33, driftX: 82, sway: -5.6, opacity: 0.17 },
  { size: 14, delay: -10, duration: 17, driftX: 39, sway: 4.2, opacity: 0.32 },
];

function SiteGlobalStyles() {
  return (
    <GlobalStyles
      styles={{
        html: { scrollBehavior: "smooth" },
        "@keyframes aliancaBubbleTravel": {
          "0%": {
            transform: "translate3d(0, 0, 0) scale(.28)",
            opacity: 0,
          },
          "8%": { opacity: "var(--bubble-opacity)" },
          "28%": {
            transform:
              "translate3d(var(--bubble-phase-one), -31vh, 0) scale(.82)",
          },
          "58%": {
            transform:
              "translate3d(var(--bubble-phase-two), -68vh, 0) scale(1.04)",
          },
          "82%": { opacity: "var(--bubble-opacity)" },
          "100%": {
            transform: "translate3d(var(--bubble-drift), -126vh, 0) scale(.72)",
            opacity: 0,
          },
        },
        "@keyframes aliancaBubbleSource": {
          "0%, 100%": { transform: "scale(.9)", opacity: 0.5 },
          "50%": { transform: "scale(1.12)", opacity: 0.9 },
        },
        "@keyframes aliancaOrbit": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "@keyframes aliancaOrbitCounter": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        "@keyframes aliancaPulseLine": {
          "0%, 100%": { transform: "scaleX(.24)", opacity: 0.45 },
          "50%": { transform: "scaleX(1)", opacity: 1 },
        },
        "@keyframes aliancaShimmer": {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(140%) skewX(-18deg)" },
        },
        "@keyframes aliancaMarquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "@keyframes aliancaFloatCard": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "@keyframes aliancaHandlePulse": {
          "0%, 100%": { boxShadow: "0 12px 30px rgba(15,33,105,.22), 0 0 0 0 rgba(9,168,229,.24)" },
          "50%": { boxShadow: "0 12px 30px rgba(15,33,105,.22), 0 0 0 10px rgba(9,168,229,0)" },
        },
        ".alianca-reveal": {
          opacity: 0,
          transform: "translateY(42px)",
          transition: "opacity 760ms ease, transform 760ms cubic-bezier(.2,.8,.2,1)",
        },
        ".alianca-reveal.is-visible": {
          opacity: 1,
          transform: "translateY(0)",
        },
        ".alianca-service-stage": {
          touchAction: "pan-y",
          userSelect: "none",
        },
        ".alianca-before-after": {
          touchAction: "pan-y",
          userSelect: "none",
        },
        "@media (prefers-reduced-motion: reduce)": {
          html: { scrollBehavior: "auto" },
          ".alianca-reveal": {
            opacity: 1,
            transform: "none",
            transition: "none",
          },
          ".alianca-orbit-ring, .alianca-orbit-upright, .alianca-floating-bubble, .alianca-marquee-track, .alianca-float-card, .alianca-bubble-source, .alianca-hero-bg": {
            animation: "none !important",
            transition: "none !important",
          },
        },
      }}
    />
  );
}

function useScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -60px" },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <Box data-reveal className="alianca-reveal" sx={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Box>
  );
}

function FloatingBubbles() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 7,
        pointerEvents: "none",
        overflow: "hidden",
        display: { xs: "none", md: "block" },
      }}
    >
      <Box
        className="alianca-bubble-source"
        sx={{
          position: "absolute",
          left: "clamp(34px, 7vw, 118px)",
          bottom: 18,
          width: 74,
          height: 34,
          animation: "aliancaBubbleSource 3.4s ease-in-out infinite",
          opacity: 0.72,
          "&:before, &:after": {
            content: '\"\"',
            position: "absolute",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.76)",
            background:
              "radial-gradient(circle at 30% 24%, rgba(255,255,255,.98), rgba(255,255,255,.3) 34%, rgba(9,168,229,.18) 68%, rgba(37,199,131,.08))",
            boxShadow: "inset -5px -6px 12px rgba(9,168,229,.12), 0 10px 28px rgba(9,168,229,.14)",
          },
          "&:before": { width: 30, height: 30, left: 4, bottom: 0 },
          "&:after": { width: 20, height: 20, left: 31, bottom: 2 },
        }}
      />

      {bubbles.slice(0, 7).map((bubble, index) => (
        <Box
          key={`${bubble.size}-${bubble.delay}-${index}`}
          className="alianca-floating-bubble"
          sx={
            {
              position: "absolute",
              left: "clamp(50px, 9vw, 148px)",
              bottom: 34,
              width: bubble.size,
              height: bubble.size,
              borderRadius: "50%",
              opacity: 0,
              background:
                "radial-gradient(circle at 28% 23%, rgba(255,255,255,.98) 0 7%, rgba(255,255,255,.44) 19%, rgba(9,168,229,.18) 53%, rgba(37,199,131,.09) 74%, rgba(255,255,255,.12) 100%)",
              border: "1px solid rgba(255,255,255,.62)",
              boxShadow: "inset -6px -8px 16px rgba(9,168,229,.1), 0 14px 36px rgba(9,168,229,.1)",
              animation: `aliancaBubbleTravel ${bubble.duration}s cubic-bezier(.25,.2,.2,1) ${bubble.delay}s infinite`,
              contain: "layout style paint",
              willChange: "transform, opacity",
              "--bubble-opacity": bubble.opacity,
              "--bubble-drift": `${bubble.driftX}vw`,
              "--bubble-phase-one": `${bubble.driftX * 0.24 + bubble.sway}vw`,
              "--bubble-phase-two": `${bubble.driftX * 0.58 - bubble.sway}vw`,
            } as CSSProperties
          }
        >
          <Box
            sx={{
              position: "absolute",
              width: "22%",
              height: "13%",
              top: "17%",
              left: "18%",
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,.74)",
              transform: "rotate(-28deg)",
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

function FloorScene() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        perspective: "1200px",
        pointerEvents: { xs: "none", md: "auto" },
      }}
    >
      <Box
        className="alianca-hero-bg"
        sx={{
          position: "absolute",
          inset: "-4% -5% -7%",
          backgroundImage: `linear-gradient(135deg, rgba(15,33,105,.42), rgba(11,120,155,.2) 48%, rgba(37,199,131,.14)), url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          filter: "saturate(1.08) contrast(1.03)",
          transform:
            "translate3d(var(--hero-shift-x, 0px), var(--hero-shift-y, 0px), 0) rotateX(var(--hero-tilt-x, 0deg)) rotateY(var(--hero-tilt-y, 0deg)) scale(var(--hero-scale, 1.06))",
          transformOrigin: "50% 55%",
          transition: "transform 420ms cubic-bezier(.2,.8,.2,1)",
          willChange: "transform",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: "35% -8% -25%",
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(135deg, rgba(9,168,229,.28), rgba(37,199,131,.1))",
          backgroundSize: "86px 86px, 86px 86px, cover",
          transform:
            "rotateX(calc(64deg + var(--hero-grid-tilt-x, 0deg))) rotateY(var(--hero-grid-tilt-y, 0deg)) rotateZ(-8deg) translate3d(var(--hero-grid-shift-x, 0px), 14%, 0) scale(var(--hero-grid-scale, 1.1))",
          transformOrigin: "50% 70%",
          transition: "transform 420ms cubic-bezier(.2,.8,.2,1)",
          willChange: "transform",
          opacity: 0.72,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: { xs: 18, md: "58%" },
          top: { xs: "18%", md: "17%" },
          width: { xs: 220, md: 310 },
          height: { xs: 220, md: 310 },
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,.34)",
          background: "radial-gradient(circle at 34% 32%, rgba(255,255,255,.78), rgba(9,168,229,.28) 34%, rgba(15,33,105,.1) 68%)",
          boxShadow: "0 28px 76px rgba(9,168,229,.22)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: { xs: 20, md: "9%" },
          bottom: { xs: 42, md: "15%" },
          width: { xs: 180, md: 320 },
          height: { xs: 86, md: 128 },
          borderRadius: "999px",
          background: "linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.06))",
          border: "1px solid rgba(255,255,255,.28)",
        }}
      />
    </Box>
  );
}

function QuoteRequestForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    serviceType: "Limpeza pós-obra premium",
    message: "",
  });

  async function submitQuoteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("idle");

    const response = await fetch("/api/public/quote-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSubmitting(false);
    if (!response.ok) {
      setStatus("error");
      return;
    }

    setForm({ name: "", phone: "", serviceType: "Limpeza pós-obra premium", message: "" });
    setStatus("success");
  }

  return (
    <Paper
      id="orcamento"
      variant="outlined"
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 1,
        borderColor: "rgba(9,168,229,.24)",
        boxShadow: "0 24px 70px rgba(15,33,105,.08)",
        position: "relative",
        overflow: "hidden",
        "&:before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(120deg, transparent 8%, rgba(255,255,255,.66) 24%, transparent 42%)",
          transform: "translateX(-120%) skewX(-18deg)",
          animation: "aliancaShimmer 4.8s ease-in-out infinite",
          pointerEvents: "none",
        },
      }}
    >
      <Stack spacing={2.2} sx={{ position: "relative" }}>
        <Box>
          <Typography variant="overline" color="primary" fontWeight={900}>
            Orçamento rápido
          </Typography>
          <Typography variant="h5" fontWeight={950}>
            Receba contato pelo WhatsApp
          </Typography>
          <Typography color="text.secondary">
            Informe seu telefone, o tipo de serviço e o que precisa ser avaliado. Nossa equipe retorna com orientação clara e próxima etapa.
          </Typography>
        </Box>

        {status === "success" && <Alert severity="success">Pedido recebido. Vamos chamar no WhatsApp.</Alert>}
        {status === "error" && <Alert severity="error">Não foi possível enviar. Confira o WhatsApp informado.</Alert>}

        <Stack component="form" spacing={1.6} onSubmit={submitQuoteRequest}>
          <TextField
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            label="WhatsApp"
            required
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="(62) 99999-9999"
          />
          <TextField
            select
            label="Serviço"
            value={form.serviceType}
            onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
          >
            {services.map((service) => (
              <MenuItem key={service} value={service}>
                {service}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mensagem"
            minRows={3}
            multiline
            value={form.message}
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            placeholder="Conte o tipo de piso, bairro e prazo ideal."
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} endIcon={<ArrowForwardRoundedIcon />}>
            Solicitar avaliação
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function LocationMapSection() {
  return (
    <Box
      id="localizacao"
      component="section"
      sx={{
        py: { xs: 6, md: 10 },
        position: "relative",
        zIndex: 2,
        overflow: "hidden",
        background: "linear-gradient(135deg, #f7fbff 0%, #eef8fc 48%, #effaf5 100%)",
        "&:before": {
          content: '""',
          position: "absolute",
          inset: 0,
          opacity: 0.46,
          backgroundImage:
            "linear-gradient(90deg, rgba(9,168,229,.08) 1px, transparent 1px), linear-gradient(0deg, rgba(37,199,131,.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: "relative" }}>
        <Reveal>
          <Stack spacing={2} sx={{ maxWidth: 820, mb: { xs: 3.5, md: 5 } }}>
            <Typography variant="overline" color="primary" fontWeight={900}>
              Localização
            </Typography>
            <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05, letterSpacing: 0 }}>
              Base em Goiânia para atender com agilidade e cuidado.
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 18 }}>
              A Aliança atende residências, condomínios, obras e imóveis de alto padrão em Goiânia e região metropolitana.
            </Typography>
          </Stack>
        </Reveal>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: ".82fr 1.18fr" }, gap: { xs: 2.5, lg: 3 }, alignItems: "stretch" }}>
          <Reveal delay={80}>
            <Paper
              variant="outlined"
              sx={{
                height: "100%",
                minHeight: { xs: 0, lg: 520 },
                p: { xs: 2.4, md: 3 },
                borderRadius: 1,
                color: "white",
                bgcolor: "#0f2169",
                borderColor: "rgba(255,255,255,.16)",
                boxShadow: "0 28px 90px rgba(15,33,105,.18)",
                position: "relative",
                overflow: "hidden",
                "&:before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(9,168,229,.28), transparent 42%), linear-gradient(315deg, rgba(37,199,131,.2), transparent 48%)",
                  pointerEvents: "none",
                },
              }}
            >
              <Stack spacing={2.4} sx={{ position: "relative", height: "100%" }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip icon={<LocationOnRoundedIcon />} label="Base em Goiânia" sx={{ color: "white", bgcolor: "rgba(255,255,255,.12)" }} />
                  <Chip icon={<MapRoundedIcon />} label="Região metropolitana" sx={{ color: "white", bgcolor: "rgba(255,255,255,.12)" }} />
                </Stack>

                <Box>
                  <Typography color="rgba(255,255,255,.72)" fontWeight={800}>
                    Endereço
                  </Typography>
                  <Typography variant="h5" fontWeight={950} sx={{ lineHeight: 1.18, mt: 0.5 }}>
                    {businessLocation.address}
                  </Typography>
                  <Typography color="rgba(255,255,255,.76)" sx={{ mt: 0.7 }}>
                    {businessLocation.cep}
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: "rgba(255,255,255,.16)" }} />

                <Stack spacing={1.4}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <NearMeRoundedIcon sx={{ color: "#25c783" }} />
                    <Typography fontWeight={900}>{businessLocation.coverage}</Typography>
                  </Stack>
                  {businessLocation.hours.map((hour) => (
                    <Stack key={hour} direction="row" spacing={1.2} alignItems="center">
                      <AccessTimeRoundedIcon sx={{ color: "#09a8e5" }} />
                      <Typography color="rgba(255,255,255,.82)">{hour}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.2, mt: { xs: 0, lg: "auto" } }}>
                  <Button href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer" variant="contained" endIcon={<NearMeRoundedIcon />}>
                    Abrir rota
                  </Button>
                  <Button href="#orcamento" component="a" variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,.45)" }}>
                    Solicitar orçamento
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Reveal>

          <Reveal delay={160}>
            <Paper
              variant="outlined"
              sx={{
                minHeight: { xs: 420, sm: 500, lg: 520 },
                borderRadius: 1,
                overflow: "hidden",
                position: "relative",
                borderColor: "rgba(9,168,229,.22)",
                boxShadow: "0 30px 90px rgba(15,33,105,.14)",
                bgcolor: "white",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  left: { xs: 14, sm: 22 },
                  top: { xs: 14, sm: 22 },
                  right: { xs: 14, sm: "auto" },
                  zIndex: 2,
                  maxWidth: { xs: "calc(100% - 28px)", sm: 360 },
                  p: 1.4,
                  borderRadius: 1,
                  bgcolor: "rgba(255,255,255,.94)",
                  border: "1px solid rgba(9,168,229,.18)",
                  boxShadow: "0 18px 50px rgba(15,33,105,.14)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 38, height: 38, borderRadius: 1, display: "grid", placeItems: "center", bgcolor: "rgba(37,199,131,.12)", color: "secondary.main" }}>
                    <LocationOnRoundedIcon />
                  </Box>
                  <Box>
                    <Typography fontWeight={950}>Veja no mapa</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {businessLocation.address}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box
                component="iframe"
                title="Mapa da Aliança Limpeza e Restauração em Goiânia"
                src={mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sx={{
                  width: "100%",
                  height: "100%",
                  minHeight: { xs: 420, sm: 500, lg: 520 },
                  border: 0,
                  display: "block",
                  filter: "saturate(1.04) contrast(1.02)",
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  left: { xs: 14, sm: 22 },
                  right: { xs: 14, sm: 22 },
                  bottom: { xs: 14, sm: 22 },
                  zIndex: 2,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                  gap: 1,
                  alignItems: "center",
                  p: 1.4,
                  borderRadius: 1,
                  bgcolor: "rgba(15,33,105,.86)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,.18)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <Box>
                  <Typography fontWeight={950}>Atendimento local com operação organizada.</Typography>
                  <Typography variant="body2" color="rgba(255,255,255,.76)">
                    Informe bairro, tipo de piso e prazo para receber a avaliação correta.
                  </Typography>
                </Box>
                <Button href="#orcamento" component="a" variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />}>
                  Pedir avaliação
                </Button>
              </Box>
            </Paper>
          </Reveal>
        </Box>
      </Container>
    </Box>
  );
}

function CircularServiceCarousel() {
  const cardCount = serviceShowcase.length;
  const step = 360 / cardCount;
  const radius = 350;
  const activeIndexRef = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, baseIndex: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const signedAngle = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
  const visualRotation = -activeIndex * step + dragOffset;

  const moveTo = (index: number) => {
    setActiveIndex((index + cardCount) % cardCount);
    setDragOffset(0);
  };

  const rotateBy = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + cardCount) % cardCount);
    setDragOffset(0);
  };

  const finishDrag = (element?: Element, pointerId?: number) => {
    if (dragRef.current.active) {
      const indexOffset = Math.round(-dragOffset / step);
      setActiveIndex((dragRef.current.baseIndex + indexOffset + cardCount) % cardCount);
    }

    dragRef.current.active = false;
    setDragging(false);
    setDragOffset(0);

    if (element && pointerId !== undefined && "hasPointerCapture" in element) {
      const pointerElement = element as Element & {
        hasPointerCapture: (id: number) => boolean;
        releasePointerCapture: (id: number) => void;
      };
      if (pointerElement.hasPointerCapture(pointerId)) pointerElement.releasePointerCapture(pointerId);
    }
  };

  return (
    <Box>
      <Box
        className="alianca-service-stage"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          if ((event.target as HTMLElement).closest("button")) return;
          dragRef.current = {
            active: true,
            startX: event.clientX,
            baseIndex: activeIndexRef.current,
          };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current.active) return;
          const nextOffset = Math.max(-step * 1.15, Math.min(step * 1.15, (event.clientX - dragRef.current.startX) * 0.23));
          setDragOffset(nextOffset);
        }}
        onPointerUp={(event) => finishDrag(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.currentTarget, event.pointerId)}
        sx={{
          display: { xs: "none", md: "block" },
          height: 630,
          position: "relative",
          perspective: "1450px",
          perspectiveOrigin: "50% 46%",
          overflow: "hidden",
          cursor: dragging ? "grabbing" : "grab",
          borderRadius: 3,
          background:
            "radial-gradient(circle at 50% 46%, rgba(255,255,255,.98) 0 13%, rgba(223,245,252,.74) 35%, rgba(238,248,252,.22) 58%, transparent 74%)",
          border: "1px solid rgba(9,168,229,.1)",
          contain: "layout paint style",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "51%",
            width: 810,
            height: 230,
            borderRadius: "50%",
            border: "1px solid rgba(9,168,229,.17)",
            transform: "translate(-50%, -50%) rotateX(69deg)",
            boxShadow: "inset 0 0 34px rgba(9,168,229,.05)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "64%",
            width: 600,
            height: 80,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "rgba(15,33,105,.08)",
          }}
        />

        {serviceShowcase.map((service, index) => {
          const angle = index * step + visualRotation;
          const radians = (angle * Math.PI) / 180;
          const depth = (Math.cos(radians) + 1) / 2;
          const scale = 0.84 + depth * 0.15;
          const opacity = 0.36 + depth * 0.64;
          const isFront = Math.abs(signedAngle(angle)) < step * 0.54;

          return (
            <Paper
              key={service.title}
              component="button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                moveTo(index);
              }}
              aria-label={`Exibir ${service.title}`}
              variant="outlined"
              sx={{
                appearance: "none",
                textAlign: "left",
                p: 0,
                m: 0,
                font: "inherit",
                position: "absolute",
                left: "50%",
                top: "47%",
                width: 278,
                height: 354,
                borderRadius: 3,
                overflow: "hidden",
                transformStyle: "preserve-3d",
                transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle}deg) scale(${scale})`,
                opacity,
                zIndex: Math.round(depth * 100),
                backfaceVisibility: "hidden",
                borderColor: isFront ? `${service.color}66` : "rgba(9,168,229,.14)",
                boxShadow: isFront
                  ? `0 24px 54px rgba(15,33,105,.18), 0 0 0 1px ${service.color}18`
                  : "0 12px 30px rgba(15,33,105,.09)",
                bgcolor: "rgba(255,255,255,.97)",
                cursor: "pointer",
                pointerEvents: depth > 0.34 ? "auto" : "none",
                transition: dragging
                  ? "none"
                  : "transform 760ms cubic-bezier(.2,.8,.2,1), opacity 760ms ease, border-color 760ms ease, box-shadow 760ms ease",
                willChange: dragging || isFront ? "transform, opacity" : "auto",
                "&:focus-visible": {
                  outline: `3px solid ${service.color}`,
                  outlineOffset: 4,
                },
              }}
            >
              <Box sx={{ position: "relative", height: 184, overflow: "hidden" }}>
                <Box
                  component="img"
                  src={service.image}
                  alt={service.title}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(180deg, transparent 26%, ${service.color}c7 118%)`,
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    left: 16,
                    bottom: 14,
                    px: 1.15,
                    py: 0.55,
                    borderRadius: 999,
                    color: "white",
                    bgcolor: "rgba(6,15,34,.45)",
                    border: "1px solid rgba(255,255,255,.28)",
                  }}
                >
                  <Typography variant="caption" fontWeight={950}>
                    {String(index + 1).padStart(2, "0")} / {String(cardCount).padStart(2, "0")}
                  </Typography>
                </Box>
              </Box>
              <Stack spacing={1.15} sx={{ p: 2.15 }}>
                <Chip
                  size="small"
                  label={service.metric}
                  sx={{
                    alignSelf: "flex-start",
                    color: service.color,
                    borderColor: `${service.color}55`,
                    bgcolor: `${service.color}0c`,
                    fontWeight: 900,
                  }}
                  variant="outlined"
                />
                <Typography variant="h6" fontWeight={950} sx={{ lineHeight: 1.08 }}>
                  {service.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                  {service.short}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>
                  {service.metricLabel}
                </Typography>
              </Stack>
            </Paper>
          );
        })}

        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "47%",
            width: 224,
            height: 224,
            borderRadius: "50%",
            transform: "translate(-50%, -50%) translateZ(20px)",
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(circle at 35% 28%, rgba(255,255,255,1), rgba(238,251,255,.96) 42%, rgba(9,168,229,.13) 74%, rgba(15,33,105,.09))",
            border: "1px solid rgba(9,168,229,.22)",
            boxShadow:
              "0 24px 62px rgba(9,168,229,.14), inset 0 0 28px rgba(255,255,255,.88)",
            zIndex: 44,
            pointerEvents: "none",
          }}
        >
          <Box
            component="img"
            src="/logo-alianca.png"
            alt="Aliança Limpeza e Restauração"
            draggable={false}
            sx={{ width: 140, height: 140, objectFit: "contain" }}
          />
        </Box>

        <Paper
          variant="outlined"
          sx={{
            position: "absolute",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            zIndex: 130,
            px: 1.2,
            py: 0.9,
            borderRadius: 999,
            bgcolor: "rgba(255,255,255,.88)",
            borderColor: "rgba(9,168,229,.18)",
            boxShadow: "0 12px 30px rgba(15,33,105,.1)",
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            <IconButton size="small" aria-label="Serviço anterior" onClick={() => rotateBy(1)}>
              <ChevronLeftRoundedIcon />
            </IconButton>
            {serviceShowcase.map((service, index) => (
              <Box
                key={service.title}
                component="button"
                type="button"
                aria-label={`Ir para ${service.title}`}
                onClick={() => moveTo(index)}
                sx={{
                  width: activeIndex === index ? 28 : 8,
                  height: 8,
                  p: 0,
                  border: 0,
                  borderRadius: 999,
                  bgcolor: activeIndex === index ? service.color : "rgba(15,33,105,.18)",
                  cursor: "pointer",
                  transition: "width 280ms ease, background-color 280ms ease",
                }}
              />
            ))}
            <IconButton size="small" aria-label="Próximo serviço" onClick={() => rotateBy(-1)}>
              <ChevronRightRoundedIcon />
            </IconButton>
          </Stack>
        </Paper>
      </Box>

      <Box
        sx={{
          display: { xs: "grid", md: "none" },
          gridAutoFlow: "column",
          gridAutoColumns: "88%",
          gap: 1.5,
          overflowX: "auto",
          pb: 1.5,
          px: 0.5,
          scrollSnapType: "x mandatory",
          scrollPaddingInline: 4,
          scrollBehavior: "smooth",
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {serviceShowcase.map((service, index) => (
          <Paper
            key={service.title}
            variant="outlined"
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              scrollSnapAlign: "center",
              borderColor: `${service.color}33`,
              boxShadow: "0 22px 60px rgba(15,33,105,.1)",
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Box component="img" src={service.image} alt={service.title} sx={{ width: "100%", height: 210, objectFit: "cover" }} />
              <Chip
                size="small"
                label={`${index + 1}/${cardCount}`}
                sx={{ position: "absolute", top: 14, right: 14, bgcolor: "rgba(255,255,255,.88)", fontWeight: 900 }}
              />
            </Box>
            <Stack spacing={1} sx={{ p: 2.2 }}>
              <Typography variant="h6" fontWeight={950}>
                {service.title}
              </Typography>
              <Typography color="text.secondary">{service.short}</Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

function GuaranteeOrbit() {
  const orbitDuration = "32s";
  const mobileOrbitSize = "min(70vw, 292px)";
  const mobileHaloSize = "min(84vw, 350px)";
  const mobileCoreSize = "min(54vw, 204px)";

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: 370, sm: 430, md: 540 },
        width: "100%",
        maxWidth: { xs: 392, sm: 520, md: 620 },
        mx: "auto",
        px: { xs: 1, sm: 0 },
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: { xs: mobileHaloSize, sm: 350, md: 474 },
          height: { xs: mobileHaloSize, sm: 350, md: 474 },
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,.92) 0 31%, rgba(9,168,229,.06) 32% 33%, transparent 34% 100%)",
          boxShadow: "inset 0 0 80px rgba(9,168,229,.05)",
        }}
      />

      <Box
        className="alianca-orbit-ring"
        sx={{
          position: "absolute",
          zIndex: 3,
          width: { xs: mobileOrbitSize, sm: 308, md: 420 },
          height: { xs: mobileOrbitSize, sm: 308, md: 420 },
          borderRadius: "50%",
          border: "1px solid rgba(9,168,229,.24)",
          animation: `aliancaOrbit ${orbitDuration} linear infinite`,
          boxShadow: {
            xs: "0 0 0 10px rgba(9,168,229,.025), inset 0 0 34px rgba(9,168,229,.045)",
            sm: "0 0 0 18px rgba(9,168,229,.025), inset 0 0 42px rgba(9,168,229,.045)",
          },
          "&:before": {
            content: '\"\"',
            position: "absolute",
            inset: { xs: -5, sm: -7 },
            borderRadius: "50%",
            border: "1px dashed rgba(37,199,131,.2)",
          },
        }}
      >
        {orbitItems.map((item, index) => {
          const angle = (360 / orbitItems.length) * index;
          return (
            <Box
              key={item}
              sx={{
                position: "absolute",
                inset: 0,
                transform: `rotate(${angle}deg)`,
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  left: "100%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
                }}
              >
                <Box
                  className="alianca-orbit-upright"
                  sx={{
                    animation: `aliancaOrbitCounter ${orbitDuration} linear infinite`,
                  }}
                >
                  <Chip
                    label={item}
                    color="primary"
                    variant="outlined"
                    sx={{
                      height: { xs: 28, sm: 32 },
                      fontSize: { xs: 11, sm: 13 },
                      bgcolor: "rgba(255,255,255,.97)",
                      borderColor: index % 2 === 0 ? "rgba(9,168,229,.34)" : "rgba(37,199,131,.38)",
                      color: index % 2 === 0 ? "primary.main" : "secondary.dark",
                      fontWeight: 950,
                      minWidth: { xs: 80, sm: 0 },
                      boxShadow: {
                        xs: "0 10px 28px rgba(15,33,105,.12)",
                        sm: "0 14px 38px rgba(15,33,105,.13)",
                      },
                      backdropFilter: "blur(12px)",
                      "& .MuiChip-label": {
                        px: { xs: 1, sm: 1.4 },
                      },
                      "&:before": {
                        content: '\"\"',
                        width: { xs: 6, sm: 7 },
                        height: { xs: 6, sm: 7 },
                        borderRadius: "50%",
                        mr: { xs: 0.55, sm: 0.8 },
                        bgcolor: index % 2 === 0 ? "primary.main" : "secondary.main",
                        boxShadow: index % 2 === 0 ? "0 0 14px rgba(9,168,229,.7)" : "0 0 14px rgba(37,199,131,.7)",
                      },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Paper
        variant="outlined"
        sx={{
          position: "relative",
          zIndex: 2,
          width: { xs: mobileCoreSize, sm: 222, md: 286 },
          height: { xs: mobileCoreSize, sm: 222, md: 286 },
          minWidth: { xs: 174, sm: 222, md: 286 },
          minHeight: { xs: 174, sm: 222, md: 286 },
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          p: { xs: 1.6, sm: 3 },
          borderColor: "rgba(37,199,131,.3)",
          boxShadow:
            "0 38px 100px rgba(15,33,105,.15), 0 0 0 14px rgba(255,255,255,.7), inset 0 0 36px rgba(9,168,229,.06)",
          bgcolor: "rgba(255,255,255,.97)",
          backdropFilter: "blur(18px)",
        }}
      >
        <Stack spacing={1.1} alignItems="center">
          <Box
            sx={{
              width: { xs: 48, sm: 64 },
              height: { xs: 48, sm: 64 },
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, rgba(37,199,131,.16), rgba(9,168,229,.12))",
              boxShadow: "inset 0 0 0 1px rgba(37,199,131,.18)",
            }}
          >
            <ShieldRoundedIcon color="secondary" sx={{ fontSize: { xs: 30, sm: 38 } }} />
          </Box>
          <Typography
            variant="h5"
            fontWeight={950}
            sx={{
              fontSize: { xs: 22, sm: 24 },
              lineHeight: 1.08,
              maxWidth: { xs: 150, sm: 220 },
            }}
          >
            Entrega com controle
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              maxWidth: { xs: 148, sm: 220 },
              fontSize: { xs: 12, sm: 14 },
              lineHeight: { xs: 1.32, sm: 1.43 },
            }}
          >
            Fotos, checklist de cuidado e garantia para uma entrega mais segura.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

function BeforeAfterCard({ item, index }: { item: SiteBeforeAfter; index: number }) {
  const comparisonRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [position, setPosition] = useState(54);
  const [dragging, setDragging] = useState(false);

  const updatePosition = (clientX: number) => {
    const rect = comparisonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextPosition = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(94, Math.max(6, nextPosition)));
  };

  const stopDragging = (element?: Element, pointerId?: number) => {
    draggingRef.current = false;
    setDragging(false);

    if (element && pointerId !== undefined && "hasPointerCapture" in element) {
      const pointerElement = element as Element & {
        hasPointerCapture: (id: number) => boolean;
        releasePointerCapture: (id: number) => void;
      };
      if (pointerElement.hasPointerCapture(pointerId)) pointerElement.releasePointerCapture(pointerId);
    }
  };

  return (
    <Paper
      variant="outlined"
      className="alianca-float-card"
      sx={{
        overflow: "hidden",
        borderRadius: 4,
        animation: `aliancaFloatCard ${8 + index}s ease-in-out ${index * 0.35}s infinite`,
        borderColor: "rgba(9,168,229,.16)",
        boxShadow: "0 28px 80px rgba(15,33,105,.12)",
      }}
    >
      <Box
        ref={comparisonRef}
        className="alianca-before-after"
        role="slider"
        tabIndex={0}
        aria-label={`Comparar antes e depois de ${item.title}`}
        aria-valuemin={6}
        aria-valuemax={94}
        aria-valuenow={Math.round(position)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setPosition((current) => Math.max(6, current - 3));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setPosition((current) => Math.min(94, current + 3));
          }
          if (event.key === "Home") setPosition(6);
          if (event.key === "End") setPosition(94);
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          draggingRef.current = true;
          setDragging(true);
          updatePosition(event.clientX);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          updatePosition(event.clientX);
        }}
        onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
        sx={{
          position: "relative",
          aspectRatio: "16 / 11",
          minHeight: 260,
          backgroundColor: "#d8e9f5",
          overflow: "hidden",
          cursor: dragging ? "grabbing" : "ew-resize",
          outline: "none",
          "&:focus-visible": {
            boxShadow: "inset 0 0 0 3px #09a8e5",
          },
        }}
      >
        <Box
          component="img"
          src={item.beforeImageUrl}
          alt={`${item.title} antes`}
          draggable={false}
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          component="img"
          src={item.afterImageUrl}
          alt={`${item.title} depois`}
          draggable={false}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            clipPath: `inset(0 ${100 - position}% 0 0)`,
            willChange: "clip-path",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(15,33,105,.03) 48%, rgba(6,15,34,.5) 100%)",
          }}
        />

        <Chip
          size="small"
          label="DEPOIS"
          sx={{
            position: "absolute",
            top: 14,
            left: 14,
            bgcolor: "rgba(37,199,131,.9)",
            color: "white",
            fontWeight: 950,
            letterSpacing: ".06em",
            backdropFilter: "blur(10px)",
            pointerEvents: "none",
          }}
        />
        <Chip
          size="small"
          label="ANTES"
          sx={{
            position: "absolute",
            top: 14,
            right: 14,
            bgcolor: "rgba(15,33,105,.76)",
            color: "white",
            fontWeight: 950,
            letterSpacing: ".06em",
            backdropFilter: "blur(10px)",
            pointerEvents: "none",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${position}%`,
            width: 3,
            bgcolor: "rgba(255,255,255,.96)",
            transform: "translateX(-50%)",
            boxShadow: "0 0 0 1px rgba(15,33,105,.12), 0 0 22px rgba(255,255,255,.5)",
            pointerEvents: "none",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,.97)",
              transform: "translate(-50%, -50%)",
              display: "grid",
              placeItems: "center",
              color: "primary.main",
              border: "1px solid rgba(9,168,229,.2)",
              animation: dragging ? "none" : "aliancaHandlePulse 2.8s ease-in-out infinite",
            }}
          >
            <CompareArrowsRoundedIcon />
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            left: "50%",
            bottom: 13,
            transform: "translateX(-50%)",
            px: 1.25,
            py: 0.55,
            borderRadius: 999,
            bgcolor: "rgba(6,15,34,.52)",
            color: "white",
            fontWeight: 850,
            whiteSpace: "nowrap",
            backdropFilter: "blur(10px)",
            pointerEvents: "none",
          }}
        >
          Arraste diretamente na imagem
        </Typography>
      </Box>

      <Stack spacing={0.8} sx={{ p: 2.2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" label={item.serviceType} color="primary" variant="outlined" />
          <Typography variant="caption" color="text.secondary">
            {item.location}
          </Typography>
        </Stack>
        <Typography variant="h6" fontWeight={950}>
          {item.title}
        </Typography>
        <Typography color="text.secondary">{item.description}</Typography>
      </Stack>
    </Paper>
  );
}

function TestimonialCard({ item }: { item: SiteTestimonial }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.4, borderRadius: 1, height: "100%", minWidth: 330 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={0.4}>
          {Array.from({ length: item.rating }).map((_, index) => (
            <StarRoundedIcon key={index} fontSize="small" sx={{ color: "#25c783" }} />
          ))}
        </Stack>
        <Typography sx={{ fontSize: 18, lineHeight: 1.45 }}>&quot;{item.quote}&quot;</Typography>
        <Divider />
        <Box>
          <Typography fontWeight={900}>{item.customerName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {item.roleOrNeighborhood} - {item.serviceType}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function HeroNav() {
  const links = [
    ["Serviços", "#servicos"],
    ["Método", "#metodo"],
    ["Antes/depois", "#antes-depois"],
    ["Avaliações", "#avaliacoes"],
    ["Localização", "#localizacao"],
  ];

  return (
    <Box component="header" sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 5, py: 2 }}>
      <Container maxWidth="xl">
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={1.4} alignItems="center">
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: 1,
                bgcolor: "rgba(255,255,255,.92)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.52)",
              }}
            >
              <Box component="img" src="/logo-alianca.png" alt="Aliança Limpeza e Restauração" sx={{ width: 50, height: 50, objectFit: "contain" }} />
            </Box>
            <Box>
              <Typography fontWeight={950} color="white" sx={{ textShadow: "0 2px 18px rgba(0,0,0,.24)" }}>
                Aliança
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,.82)">
                Limpeza e restauração
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
            {links.map(([label, href]) => (
              <Button key={href} href={href} component="a" sx={{ color: "white" }}>
                {label}
              </Button>
            ))}
          </Stack>

          <Button href="#orcamento" component="a" variant="contained" startIcon={<LocalPhoneRoundedIcon />} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
            Solicitar orçamento
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

export function PublicSiteView({
  beforeAfters,
  testimonials,
}: {
  beforeAfters: SiteBeforeAfter[];
  testimonials: SiteTestimonial[];
}) {
  const rootRef = useScrollReveal();
  const heroInteractionRef = useRef<HTMLElement | null>(null);
  const publishedBeforeAfters = useMemo(() => beforeAfters.filter((item) => item.isPublished).slice(0, 6), [beforeAfters]);
  const publishedTestimonials = useMemo(() => testimonials.filter((item) => item.isPublished).slice(0, 6), [testimonials]);
  const testimonialRail = useMemo(() => [...publishedTestimonials, ...publishedTestimonials], [publishedTestimonials]);

  function resetHeroMotion() {
    const element = heroInteractionRef.current;
    if (!element) return;
    element.style.setProperty("--hero-tilt-x", "0deg");
    element.style.setProperty("--hero-tilt-y", "0deg");
    element.style.setProperty("--hero-shift-x", "0px");
    element.style.setProperty("--hero-shift-y", "0px");
    element.style.setProperty("--hero-scale", "1.06");
    element.style.setProperty("--hero-grid-tilt-x", "0deg");
    element.style.setProperty("--hero-grid-tilt-y", "0deg");
    element.style.setProperty("--hero-grid-shift-x", "0px");
    element.style.setProperty("--hero-grid-scale", "1.1");
  }

  function moveHeroMotion(event: ReactPointerEvent<HTMLElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = heroInteractionRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const distance = Math.min(1, Math.hypot(x, y) * 1.45);

    element.style.setProperty("--hero-tilt-x", `${(-y * 2.2).toFixed(2)}deg`);
    element.style.setProperty("--hero-tilt-y", `${(x * 2.8).toFixed(2)}deg`);
    element.style.setProperty("--hero-shift-x", `${(-x * 10).toFixed(1)}px`);
    element.style.setProperty("--hero-shift-y", `${(-y * 8).toFixed(1)}px`);
    element.style.setProperty("--hero-scale", (1.06 + distance * 0.018).toFixed(3));
    element.style.setProperty("--hero-grid-tilt-x", `${(-y * 1.8).toFixed(2)}deg`);
    element.style.setProperty("--hero-grid-tilt-y", `${(x * 2.2).toFixed(2)}deg`);
    element.style.setProperty("--hero-grid-shift-x", `${(-x * 8).toFixed(1)}px`);
    element.style.setProperty("--hero-grid-scale", (1.1 + distance * 0.016).toFixed(3));
  }

  return (
    <Box ref={rootRef} className="alianca-public-site" sx={{ bgcolor: "#f7fbff", color: "#11203d", overflowX: "hidden", position: "relative", isolation: "isolate" }}>
      <SiteGlobalStyles />
      <FloatingBubbles />
      <HeroNav />

      <Box
        ref={heroInteractionRef}
        component="section"
        onPointerMove={moveHeroMotion}
        onPointerLeave={resetHeroMotion}
        sx={{
          position: "relative",
          minHeight: { xs: 780, md: "96vh" },
          display: "flex",
          alignItems: "center",
          color: "white",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0f2169 0%, #0b789b 48%, #25c783 100%)",
          zIndex: 2,
          "--hero-tilt-x": "0deg",
          "--hero-tilt-y": "0deg",
          "--hero-shift-x": "0px",
          "--hero-shift-y": "0px",
          "--hero-scale": "1.06",
          "--hero-grid-tilt-x": "0deg",
          "--hero-grid-tilt-y": "0deg",
          "--hero-grid-shift-x": "0px",
          "--hero-grid-scale": "1.1",
        }}
      >
        <FloorScene />
        <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(6,15,34,.52)" }} />
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2, pt: 12, pb: { xs: 8, md: 12 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.05fr .95fr" }, gap: { xs: 5, lg: 8 }, alignItems: "center" }}>
            <Stack spacing={3.2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<ShieldRoundedIcon />} label="Proteção do imóvel" sx={{ bgcolor: "rgba(255,255,255,.14)", color: "white" }} />
                <Chip icon={<CheckCircleRoundedIcon />} label="Serviço com garantia" sx={{ bgcolor: "rgba(255,255,255,.14)", color: "white" }} />
                <Chip icon={<WaterDropRoundedIcon />} label="Acabamento fino" sx={{ bgcolor: "rgba(255,255,255,.14)", color: "white" }} />
              </Stack>
              <Typography variant="h1" sx={{ fontSize: { xs: 48, sm: 68, lg: 88 }, lineHeight: 0.92, maxWidth: 980, letterSpacing: 0 }}>
                Seu imóvel limpo, protegido e pronto para impressionar.
              </Typography>
              <Typography sx={{ fontSize: { xs: 18, md: 23 }, lineHeight: 1.48, color: "rgba(255,255,255,.88)", maxWidth: 760 }}>
                Limpeza pós-obra, restauração de mármore, polimento de granito e cuidado fino para porcelanato com diagnóstico técnico, proteção das áreas sensíveis e entrega documentada.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.2, maxWidth: 820 }}>
                {[
                  ["Avaliação técnica", "A equipe entende o piso antes de aplicar produto ou máquina."],
                  ["Cuidado com detalhes", "Rodapés, metais, móveis e circulação são protegidos."],
                  ["Resultado comprovado", "Fotos e revisão final deixam a entrega mais segura."],
                ].map(([title, text]) => (
                  <Box key={title} sx={{ p: 1.6, borderRadius: 1, bgcolor: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(12px)" }}>
                    <Typography fontWeight={950}>{title}</Typography>
                    <Typography variant="body2" color="rgba(255,255,255,.76)">
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4}>
                <Button href="#orcamento" component="a" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />}>
                  Solicitar orçamento pelo WhatsApp
                </Button>
                <Button href="#antes-depois" component="a" variant="outlined" size="large" sx={{ color: "white", borderColor: "rgba(255,255,255,.56)" }}>
                  Ver antes e depois
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ display: { xs: "none", lg: "block" }, position: "relative", minHeight: 470 }}>
              <Paper
                variant="outlined"
                sx={{
                  position: "absolute",
                  right: 0,
                  top: 30,
                  width: 440,
                  borderRadius: 1,
                  overflow: "hidden",
                  bgcolor: "rgba(255,255,255,.14)",
                  borderColor: "rgba(255,255,255,.3)",
                  backdropFilter: "blur(18px)",
                  boxShadow: "0 32px 90px rgba(0,0,0,.24)",
                }}
              >
                <Box sx={{ position: "relative" }}>
                  <Box component="img" src={detailImage} alt="Ambiente de alto padrão com piso restaurado" sx={{ width: "100%", height: 270, objectFit: "cover", display: "block" }} />
                  <Chip
                    icon={<WorkspacePremiumRoundedIcon />}
                    label="Entrega premium"
                    sx={{
                      position: "absolute",
                      left: 18,
                      bottom: 18,
                      bgcolor: "rgba(255,255,255,.94)",
                      color: "#11203d",
                      fontWeight: 950,
                    }}
                  />
                </Box>
                <Stack spacing={1.4} sx={{ p: 2.5 }}>
                  <Typography fontWeight={950} sx={{ fontSize: 20 }}>
                    Cuidado visível antes, durante e depois.
                  </Typography>
                  <Typography color="rgba(255,255,255,.82)">
                    O serviço começa protegendo o imóvel, segue por etapas técnicas e termina com revisão de acabamento para você receber tudo limpo, seguro e apresentável.
                  </Typography>
                  <Box sx={{ height: 4, bgcolor: "rgba(255,255,255,.18)", borderRadius: 999, overflow: "hidden" }}>
                    <Box sx={{ width: "100%", height: "100%", bgcolor: "#25c783", transformOrigin: "left", animation: "aliancaPulseLine 2.7s ease-in-out infinite" }} />
                  </Box>
                </Stack>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  position: "absolute",
                  left: -34,
                  bottom: 16,
                  width: 230,
                  borderRadius: 1,
                  p: 1.7,
                  bgcolor: "rgba(255,255,255,.94)",
                  boxShadow: "0 26px 70px rgba(0,0,0,.2)",
                  zIndex: 3,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoFixHighRoundedIcon color="secondary" />
                    <Typography color="#11203d" fontWeight={950}>
                      Revisão de acabamento
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Brilho, limpeza fina, cantos e detalhes conferidos antes da entrega.
                  </Typography>
                </Stack>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  position: "absolute",
                  left: 44,
                  top: 98,
                  width: 230,
                  borderRadius: 1,
                  p: 1.8,
                  bgcolor: "rgba(15,33,105,.72)",
                  color: "white",
                  borderColor: "rgba(255,255,255,.22)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 22px 70px rgba(0,0,0,.18)",
                }}
              >
                <Stack spacing={1.1}>
                  {["Piso identificado", "Áreas sensíveis protegidas", "Produto adequado"].map((item) => (
                    <Stack key={item} direction="row" spacing={0.8} alignItems="center">
                      <CheckCircleRoundedIcon sx={{ color: "#25c783", fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={850}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 7 }, mt: { xs: -4, md: -6 }, position: "relative", zIndex: 3 }}>
        <Container maxWidth="xl">
          <Reveal>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              {heroStats.map(([value, label]) => (
                <Paper key={label} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, boxShadow: "0 20px 70px rgba(15,33,105,.08)" }}>
                  <Typography variant="h3" color="primary" sx={{ fontSize: { xs: 30, md: 44 }, letterSpacing: 0 }}>
                    {value}
                  </Typography>
                  <Typography color="text.secondary" fontWeight={800}>
                    {label}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Reveal>
        </Container>
      </Box>

      <Box id="servicos" component="section" sx={{ py: { xs: 6, md: 10 }, position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Reveal>
            <Stack spacing={2.5} alignItems="center" textAlign="center" sx={{ maxWidth: 860, mx: "auto", mb: { xs: 4, md: 6 } }}>
              <Typography variant="overline" color="primary" fontWeight={900}>
                Experiência técnica em movimento
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: 36, md: 58 }, lineHeight: 1.04, letterSpacing: 0 }}>
                Serviços que parecem simples, mas exigem precisão.
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                O site mostra a força da operação: cada serviço tem método, equipamento, produto certo e equipe treinada.
              </Typography>
            </Stack>
          </Reveal>
          <Reveal delay={120}>
            <CircularServiceCarousel />
          </Reveal>
        </Container>
      </Box>

      <Box id="metodo" component="section" sx={{ py: { xs: 6, md: 10 }, bgcolor: "#eef8fc", position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: ".9fr 1.1fr" }, gap: { xs: 5, lg: 8 }, alignItems: "center" }}>
            <Reveal>
              <Stack spacing={2.4}>
                <Typography variant="overline" color="primary" fontWeight={900}>
                  Método Aliança
                </Typography>
                <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                  Um serviço premium não começa na máquina. Começa no controle.
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                  A execução combina avaliação, proteção, equipe certa, checklist, fotos e pós-venda. É isso que reduz retrabalho e aumenta confiança.
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  {commercialBlocks.map((block, index) => (
                    <Paper key={block.title} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                      <Stack spacing={1.2}>
                        <Box sx={{ color: index === 0 ? "primary.main" : index === 1 ? "secondary.main" : "#0f2169" }}>{block.icon}</Box>
                        <Typography fontWeight={950}>{block.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {block.text}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              </Stack>
            </Reveal>

            <Reveal delay={140}>
              <Box sx={{ display: "grid", gap: 1.6 }}>
                {processSteps.map((step, index) => (
                  <Paper
                    key={step.title}
                    variant="outlined"
                    sx={{
                      p: 2.4,
                      borderRadius: 1,
                      display: "grid",
                      gridTemplateColumns: "56px 1fr",
                      gap: 2,
                      alignItems: "center",
                      transform: { md: `translateX(${index % 2 === 0 ? 0 : 26}px)` },
                      boxShadow: "0 18px 56px rgba(15,33,105,.08)",
                    }}
                  >
                    <Box sx={{ width: 56, height: 56, borderRadius: 1, display: "grid", placeItems: "center", bgcolor: "rgba(9,168,229,.11)", color: "primary.main" }}>
                      {step.icon}
                    </Box>
                    <Box>
                      <Typography fontWeight={950}>{step.title}</Typography>
                      <Typography color="text.secondary">{step.text}</Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Reveal>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 10 }, position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 5, lg: 8 }, alignItems: "center" }}>
            <Reveal>
              <GuaranteeOrbit />
            </Reveal>
            <Reveal delay={160}>
              <Stack spacing={2.5}>
                <Typography variant="overline" color="primary" fontWeight={900}>
                  Serviço organizado
                </Typography>
                <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                  Seu piso tratado com cuidado do orçamento à entrega.
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                  A Aliança usa gestão interna para organizar atendimento, equipe, produtos, fotos e pós-venda. Para você, isso aparece como prazo claro, proteção do imóvel e entrega bem documentada.
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  {[
                    ["Orçamento rápido", "Seu pedido chega organizado para retorno pelo WhatsApp."],
                    ["Proteção do imóvel", "Pisos, rodapés, metais, marcenaria e áreas sensíveis recebem cuidado antes da execução."],
                    ["Execução acompanhada", "A equipe segue etapas técnicas para reduzir retrabalho e preservar o acabamento."],
                    ["Entrega documentada", "Fotos, orientação de conservação e garantia deixam o resultado mais seguro."],
                  ].map(([title, text]) => (
                    <Stack key={title} direction="row" spacing={1.2} alignItems="flex-start">
                      <CheckCircleRoundedIcon color="secondary" />
                      <Box>
                        <Typography fontWeight={900}>{title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {text}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Box>
              </Stack>
            </Reveal>
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 5, md: 8 }, bgcolor: "#0f2169", color: "white", position: "relative", zIndex: 2, overflow: "hidden" }}>
        <Container maxWidth="xl">
          <Reveal>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
              {[
                [<ScienceRoundedIcon key="science" />, "Produto certo", "Química adequada para cada superfície."],
                [<BoltRoundedIcon key="bolt" />, "Execução ágil", "Equipe orientada por etapas e prioridades."],
                [<CameraAltRoundedIcon key="camera" />, "Fotos de prova", "Antes, durante e depois documentados."],
                [<AutoAwesomeRoundedIcon key="spark" />, "Acabamento premium", "Entrega pensada para encantar."],
              ].map(([icon, title, text]) => (
                <Paper key={String(title)} variant="outlined" sx={{ p: 2.4, borderRadius: 1, bgcolor: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.16)", color: "white" }}>
                  <Stack spacing={1.2}>
                    <Box sx={{ color: "#25c783" }}>{icon}</Box>
                    <Typography fontWeight={950}>{title}</Typography>
                    <Typography variant="body2" color="rgba(255,255,255,.74)">
                      {text}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Reveal>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 6, md: 10 }, position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: ".92fr 1.08fr" }, gap: { xs: 4, lg: 7 }, alignItems: "center" }}>
            <Reveal>
              <Stack spacing={2.4}>
                <Typography variant="overline" color="primary" fontWeight={900}>
                  Atendimento que vende
                </Typography>
                <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                  Peça seu orçamento sem complicação.
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                  Você chama pelo formulário, informa o WhatsApp e recebe um retorno comercial com o serviço certo para seu piso, imóvel ou pós-obra.
                </Typography>
                <Stack spacing={1.2}>
                  {[
                    "Telefone do WhatsApp obrigatório para acelerar contato.",
                    "Tipo de serviço já chega classificado para o comercial.",
                    "Mensagem livre ajuda a entender urgência, bairro e tipo de piso.",
                  ].map((item) => (
                    <Stack key={item} direction="row" spacing={1.2} alignItems="center">
                      <CheckCircleRoundedIcon color="secondary" />
                      <Typography fontWeight={800}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Reveal>
            <Reveal delay={140}>
              <QuoteRequestForm />
            </Reveal>
          </Box>
        </Container>
      </Box>

      <Box id="antes-depois" component="section" sx={{ py: { xs: 6, md: 10 }, bgcolor: "#eef8fc", position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Reveal>
            <Stack spacing={3}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} spacing={2}>
                <Box>
                  <Typography variant="overline" color="primary" fontWeight={900}>
                    Antes e depois
                  </Typography>
                  <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, letterSpacing: 0 }}>
                    Resultado que faz o cliente parar de rolar.
                  </Typography>
                </Box>
                <Chip icon={<AutoAwesomeRoundedIcon />} label="Arraste diretamente na imagem" color="primary" variant="outlined" />
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2.5 }}>
                {publishedBeforeAfters.map((item, index) => (
                  <BeforeAfterCard key={item.id} item={item} index={index} />
                ))}
              </Box>
            </Stack>
          </Reveal>
        </Container>
      </Box>

      <Box id="avaliacoes" component="section" sx={{ py: { xs: 6, md: 10 }, position: "relative", zIndex: 2, overflow: "hidden" }}>
        <Container maxWidth="xl">
          <Reveal>
            <Stack spacing={1.8} sx={{ maxWidth: 900, mb: 4 }}>
              <Typography variant="overline" color="primary" fontWeight={900}>
                Avaliações
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, letterSpacing: 0 }}>
                Prova social em movimento.
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                Depoimentos reais de clientes ajudam você a decidir com mais segurança.
              </Typography>
            </Stack>
          </Reveal>
        </Container>
        <Box sx={{ overflow: "hidden", py: 1 }}>
          <Stack
            className="alianca-marquee-track"
            direction="row"
            spacing={2}
            sx={{
              width: "max-content",
              animation: "aliancaMarquee 36s linear infinite",
              "&:hover": { animationPlayState: "paused" },
              px: 2,
            }}
          >
            {testimonialRail.map((item, index) => (
              <TestimonialCard key={`${item.id}-${index}`} item={item} />
            ))}
          </Stack>
        </Box>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 10 }, bgcolor: "#effaf5", position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 4, alignItems: "center" }}>
            <Reveal>
              <Stack spacing={2.4}>
                <Typography variant="overline" color="secondary" fontWeight={900}>
                  Garantia e pós-venda
                </Typography>
                <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                  O serviço não termina quando a máquina desliga.
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>
                  A entrega ideal mostra cuidado, orientação e registro. Isso aumenta confiança, reduz dúvida e melhora indicação.
                </Typography>
              </Stack>
            </Reveal>
            <Reveal delay={140}>
              <Box sx={{ display: "grid", gap: 1.5 }}>
                {[
                  "Orientação de conservação para manter o brilho por mais tempo.",
                  "Fotos de resultado para comprovar transformação.",
                  "Histórico para atendimento futuro e garantia.",
                  "Experiência de marca mais profissional para obras de alto padrão.",
                ].map((item) => (
                  <Paper key={item} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <ShieldRoundedIcon color="secondary" />
                      <Typography fontWeight={850}>{item}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Reveal>
          </Box>
        </Container>
      </Box>

      <LocationMapSection />

      <Box component="section" sx={{ py: { xs: 7, md: 11 }, position: "relative", color: "white", overflow: "hidden", zIndex: 2 }}>
        <Box component="img" src={heroImage} alt="" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(5,12,34,.68)" }} />
        <Container maxWidth="lg" sx={{ position: "relative", textAlign: "center" }}>
          <Reveal>
            <Stack spacing={3} alignItems="center">
              <Typography variant="h2" sx={{ fontSize: { xs: 36, md: 64 }, lineHeight: 1.02, letterSpacing: 0 }}>
                Quer entregar seu imóvel com aparência de novo?
              </Typography>
              <Typography sx={{ fontSize: 20, maxWidth: 760, color: "rgba(255,255,255,.82)" }}>
                Peça uma avaliação. A equipe entende o piso, indica o processo e registra tudo para uma entrega segura.
              </Typography>
              <Button href="#orcamento" component="a" variant="contained" size="large" endIcon={<LocalPhoneRoundedIcon />}>
                Solicitar orçamento agora
              </Button>
            </Stack>
          </Reveal>
        </Container>
      </Box>

      <Box component="footer" sx={{ py: 5, bgcolor: "#0f2169", color: "white", position: "relative", zIndex: 2 }}>
        <Container maxWidth="xl">
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box component="img" src="/logo-alianca.png" alt="Aliança Limpeza e Restauração" sx={{ width: 56, height: 56, objectFit: "contain", borderRadius: 1, bgcolor: "white" }} />
              <Box>
                <Typography fontWeight={950}>Aliança Limpeza e Restauração</Typography>
                <Typography color="rgba(255,255,255,.72)">Avenida Bela Vista, 957 - Jardim Bela Vista - Goiânia/GO</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label="Segunda a sexta, 8h às 18h" sx={{ color: "white", borderColor: "rgba(255,255,255,.28)" }} variant="outlined" />
              <Chip label="Sábado, 8h às 13h" sx={{ color: "white", borderColor: "rgba(255,255,255,.28)" }} variant="outlined" />
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
