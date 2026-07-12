"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import FolderSpecialRoundedIcon from "@mui/icons-material/FolderSpecialRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import SupervisorAccountRoundedIcon from "@mui/icons-material/SupervisorAccountRounded";

import type { UserRole } from "@/lib/types";
import { useColorMode } from "./AppThemeProvider";
import { useCurrentUser } from "./useCurrentUser";

const drawerWidth = 286;

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardRoundedIcon /> },
  { label: "Apresentacao", href: "/apresentacao", icon: <SlideshowRoundedIcon /> },
  { label: "Usuarios", href: "/usuarios", icon: <SupervisorAccountRoundedIcon /> },
  { label: "Clientes", href: "/clientes", icon: <GroupsRoundedIcon /> },
  { label: "Leads", href: "/leads", icon: <PersonAddAltRoundedIcon /> },
  { label: "Vistorias", href: "/vistorias", icon: <CleaningServicesRoundedIcon /> },
  { label: "Orcamentos", href: "/orcamentos", icon: <ReceiptLongRoundedIcon /> },
  { label: "Ordens de servico", href: "/ordens-servico", icon: <ConstructionRoundedIcon /> },
  { label: "Agenda", href: "/agenda", icon: <CalendarMonthRoundedIcon /> },
  { label: "Colaboradores", href: "/colaboradores", icon: <HandymanRoundedIcon /> },
  { label: "Supervisores", href: "/supervisores", icon: <SupervisorAccountRoundedIcon /> },
  { label: "Almoxarifado", href: "/almoxarifado", icon: <Inventory2RoundedIcon /> },
  { label: "Avaliacoes", href: "/avaliacoes", icon: <StarRoundedIcon /> },
  { label: "Materiais", href: "/materiais", icon: <Inventory2RoundedIcon /> },
  { label: "Equipamentos", href: "/equipamentos", icon: <FolderSpecialRoundedIcon /> },
  { label: "Financeiro", href: "/financeiro", icon: <PaidRoundedIcon /> },
  { label: "Galeria", href: "/galeria", icon: <PhotoLibraryRoundedIcon /> },
  { label: "Garantias", href: "/garantias", icon: <AccountBalanceWalletRoundedIcon /> },
  { label: "Relatorios", href: "/relatorios", icon: <AssessmentRoundedIcon /> },
  { label: "Configuracoes", href: "/configuracoes", icon: <SettingsRoundedIcon /> },
];

function canSeeMenuItem(href: string, role: UserRole) {
  if (role === "ALMOXARIFADO") {
    return ["/dashboard", "/almoxarifado", "/materiais", "/equipamentos"].includes(href);
  }
  if (href === "/usuarios" || href === "/configuracoes") return role === "OWNER";
  if (href === "/financeiro") return role === "OWNER" || role === "FINANCEIRO";
  if (href === "/almoxarifado" || href === "/materiais" || href === "/equipamentos") {
    return role === "OWNER" || role === "GERENTE";
  }
  if (href === "/orcamentos" || href === "/leads" || href === "/clientes") {
    return role === "OWNER" || role === "GERENTE" || role === "COMERCIAL";
  }
  if (href === "/supervisores" || href === "/relatorios" || href === "/apresentacao") {
    return role === "OWNER" || role === "GERENTE";
  }
  if (href === "/colaboradores") {
    return role === "OWNER" || role === "GERENTE";
  }
  if (href === "/avaliacoes") {
    return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
  }
  return true;
}

function Sidebar({ onNavigate, role }: { onNavigate?: () => void; role: UserRole }) {
  const pathname = usePathname();
  const visibleItems = menuItems.filter((item) => canSeeMenuItem(item.href, role));

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, py: 1.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
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
          <Box component="img" src="/logo-alianca.png" alt="Aliança Limpeza e Restauração" sx={{ width: 43, height: 43, objectFit: "contain" }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap>
            Aliança
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Limpeza e restauração
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <List sx={{ overflowY: "auto", pr: 0.5, flex: 1 }}>
        {visibleItems.map((item) => {
          const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={selected}
              onClick={onNavigate}
              sx={{
                borderRadius: 2,
                mb: 0.4,
                minHeight: 42,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "inherit" },
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: selected ? "inherit" : "text.secondary" }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 800 : 650 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login") {
    return <>{children}</>;
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const { mode, toggleColorMode } = useColorMode();
  const { user } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const current = menuItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return current?.label ?? "Sistema";
  }, [pathname]);
  const role = user?.role ?? "COLABORADOR";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: drawerWidth,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            },
          }}
        >
          <Sidebar role={role} />
        </Drawer>
      ) : (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: 304 } }}
        >
          <Sidebar role={role} onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ ml: { lg: `${drawerWidth}px` }, minHeight: "100vh" }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            backdropFilter: "blur(16px)",
            bgcolor: (currentTheme) =>
              currentTheme.palette.mode === "light" ? "rgba(245, 248, 253, 0.86)" : "rgba(10, 18, 39, 0.86)",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 1.5 }}>
            {!isDesktop && (
              <IconButton aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
                <MenuRoundedIcon />
              </IconButton>
            )}

            <Box sx={{ minWidth: 0, flex: { xs: 1, md: "0 0 auto" } }}>
              <Typography variant="h6" noWrap>
                {pageTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                Fluxo Lead - Cliente - Vistoria - Orçamento - OS - Entrega
              </Typography>
            </Box>

            <TextField
              size="small"
              placeholder="Busca rapida"
              sx={{ ml: "auto", display: { xs: "none", md: "block" }, width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Tooltip title={mode === "light" ? "Tema escuro" : "Tema claro"}>
              <IconButton aria-label="Alternar tema" onClick={toggleColorMode}>
                {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
              </IconButton>
            </Tooltip>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", sm: "flex" } }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.main" }}>{user?.name?.slice(0, 1) ?? "D"}</Avatar>
              <Box sx={{ minWidth: 0, maxWidth: 160 }}>
                <Typography variant="body2" fontWeight={800} noWrap>
                  {user?.name ?? "Dono"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user?.role ?? "OWNER"}
                </Typography>
              </Box>
            </Stack>

            <Tooltip title="Sair">
              <IconButton aria-label="Sair" onClick={handleLogout}>
                <LogoutRoundedIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, sm: 3, xl: 4 }, maxWidth: 1680, mx: "auto" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
