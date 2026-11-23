"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import { formatDate, formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type {
  Employee,
  ServiceOrder,
  ServiceOrderChecklistItem,
  ServiceOrderChecklistPhoto,
  SystemUser,
} from "@/lib/types";
import { StatusChip } from "./StatusChip";

type DateFilter = "ALL" | "TODAY" | "7D" | "30D" | "MONTH";

type GalleryFilters = {
  query: string;
  date: DateFilter;
  supervisorId: string;
  serviceOrderId: string;
  location: string;
  customer: string;
};

type GalleryPhoto = ServiceOrderChecklistPhoto & {
  order?: ServiceOrder;
  checklistItem?: ServiceOrderChecklistItem;
  supervisor?: Employee;
  uploadedBy?: SystemUser;
};

const defaultFilters: GalleryFilters = {
  query: "",
  date: "ALL",
  supervisorId: "",
  serviceOrderId: "",
  location: "",
  customer: "",
};

const dateOptions: Array<{ value: DateFilter; label: string }> = [
  { value: "ALL", label: "Todas as datas" },
  { value: "TODAY", label: "Hoje" },
  { value: "7D", label: "Ultimos 7 dias" },
  { value: "30D", label: "Ultimos 30 dias" },
  { value: "MONTH", label: "Este mes" },
];

function matchesDateFilter(value: string, filter: DateFilter) {
  if (filter === "ALL") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();

  if (filter === "TODAY") return time >= startOfToday;
  if (filter === "7D") return time >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30D") return time >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function serviceName(order?: ServiceOrder) {
  if (!order) return "Servico sem OS vinculada";
  return order.title || labelFor(order.serviceType);
}

function photoAlt(photo: GalleryPhoto) {
  return [serviceName(photo.order), photo.order?.customerName, labelFor(photo.type)].filter(Boolean).join(" - ");
}

function isVideoMedia(media: { url?: string; mimeType?: string; fileName?: string }) {
  const mimeType = media.mimeType?.toLowerCase() ?? "";
  const source = `${media.url ?? ""} ${media.fileName ?? ""}`.toLowerCase();
  return mimeType.startsWith("video/") || /\.(mp4|webm|mov)(?:\?|$)/i.test(source);
}

function GalleryMediaPreview({
  media,
  alt,
  controls = false,
  sx,
}: {
  media: { url?: string; mimeType?: string; fileName?: string };
  alt: string;
  controls?: boolean;
  sx?: SxProps<Theme>;
}) {
  if (isVideoMedia(media)) {
    return (
      <Box
        component="video"
        src={media.url}
        aria-label={alt}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
        sx={sx}
      />
    );
  }

  return <Box component="img" src={media.url} alt={alt} loading="lazy" sx={sx} />;
}

function PhotoCard({
  photo,
  compact = false,
  onOpen,
}: {
  photo: GalleryPhoto;
  compact?: boolean;
  onOpen: (photo: GalleryPhoto) => void;
}) {
  return (
    <Paper
      component="button"
      type="button"
      onClick={() => onOpen(photo)}
      variant="outlined"
      sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: 3,
        p: 0,
        textAlign: "left",
        bgcolor: "background.paper",
        cursor: "pointer",
        borderColor: "divider",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        "&:hover": {
          transform: { md: "translateY(-3px)" },
          borderColor: "primary.main",
          boxShadow: "0 16px 36px rgba(15, 23, 42, 0.12)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: compact ? "4 / 3" : { xs: "16 / 11", md: "4 / 3" },
          bgcolor: "action.hover",
        }}
      >
        <GalleryMediaPreview
          media={photo}
          alt={photoAlt(photo)}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <Chip
          size="small"
          label={labelFor(photo.type)}
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            bgcolor: "rgba(255,255,255,0.92)",
            fontWeight: 850,
          }}
        />
      </Box>

      <Stack spacing={0.8} sx={{ p: { xs: 1.4, md: compact ? 1.4 : 1.8 } }}>
        <Typography fontWeight={900} sx={{ fontSize: compact ? 14 : { xs: 15, md: 17 } }} noWrap>
          {photo.order?.customerName ?? "Cliente nao informado"}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13 }} noWrap>
          {serviceName(photo.order)}
        </Typography>

        {!compact && (
          <Stack spacing={0.9} sx={{ display: { xs: "none", sm: "flex" } }}>
            <Stack direction="row" spacing={0.8} alignItems="center" minWidth={0}>
              <LocationOnRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {photo.order?.address ?? "Local nao informado"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <CalendarMonthRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(photo.createdAt)}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export function GalleryView({
  photos,
  serviceOrders,
  checklistItems,
  employees,
  users,
}: {
  photos: ServiceOrderChecklistPhoto[];
  serviceOrders: ServiceOrder[];
  checklistItems: ServiceOrderChecklistItem[];
  employees: Employee[];
  users: SystemUser[];
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [filters, setFilters] = useState<GalleryFilters>(defaultFilters);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  const enrichedPhotos = useMemo<GalleryPhoto[]>(() => {
    return photos
      .map((photo) => {
        const order = serviceOrders.find((item) => item.id === photo.serviceOrderId);
        const checklistItem = checklistItems.find((item) => item.id === photo.checklistItemId);
        const supervisor = order?.supervisorEmployeeId
          ? employees.find((employee) => employee.id === order.supervisorEmployeeId)
          : undefined;
        const uploadedBy = users.find((user) => user.id === photo.uploadedByUserId);
        return { ...photo, order, checklistItem, supervisor, uploadedBy };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [checklistItems, employees, photos, serviceOrders, users]);

  const supervisorOptions = useMemo(() => {
    const ids = Array.from(new Set(serviceOrders.map((order) => order.supervisorEmployeeId).filter(Boolean))) as string[];
    return ids
      .map((id) => employees.find((employee) => employee.id === id))
      .filter((employee): employee is Employee => Boolean(employee))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, serviceOrders]);

  const serviceOptions = useMemo(() => {
    return [...serviceOrders].sort((a, b) => serviceName(a).localeCompare(serviceName(b)));
  }, [serviceOrders]);

  const filteredPhotos = useMemo(() => {
    const query = normalizeText(filters.query);
    const location = normalizeText(filters.location);
    const customer = normalizeText(filters.customer);

    return enrichedPhotos.filter((photo) => {
      const order = photo.order;
      const haystack = normalizeText(
        [
          order?.customerName,
          order?.title,
          order?.serviceType,
          order?.address,
          photo.supervisor?.name,
          photo.checklistItem?.title,
          photo.caption,
        ]
          .filter(Boolean)
          .join(" "),
      );

      const matchesQuery = !query || haystack.includes(query);
      const matchesDate = matchesDateFilter(photo.createdAt, filters.date);
      const matchesSupervisor = !filters.supervisorId || order?.supervisorEmployeeId === filters.supervisorId;
      const matchesService = !filters.serviceOrderId || order?.id === filters.serviceOrderId;
      const matchesLocation = !location || normalizeText(order?.address ?? "").includes(location);
      const matchesCustomer = !customer || normalizeText(order?.customerName ?? "").includes(customer);

      return matchesQuery && matchesDate && matchesSupervisor && matchesService && matchesLocation && matchesCustomer;
    });
  }, [enrichedPhotos, filters]);

  const recentPhotos = enrichedPhotos.slice(0, 6);
  const activeFilterCount = [
    filters.query,
    filters.supervisorId,
    filters.serviceOrderId,
    filters.location,
    filters.customer,
    filters.date !== "ALL" ? filters.date : "",
  ].filter(Boolean).length;

  function updateFilter<Key extends keyof GalleryFilters>(key: Key, value: GalleryFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
  }

  const filterControls = (
    <Stack spacing={1.4}>
      <TextField
        label="Busca rapida"
        placeholder="Cliente, servico, local..."
        value={filters.query}
        onChange={(event) => updateFilter("query", event.target.value)}
        size="small"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        select
        label="Data"
        value={filters.date}
        onChange={(event) => updateFilter("date", event.target.value as DateFilter)}
        size="small"
        fullWidth
      >
        {dateOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Supervisor"
        value={filters.supervisorId}
        onChange={(event) => updateFilter("supervisorId", event.target.value)}
        size="small"
        fullWidth
      >
        <MenuItem value="">Todos os supervisores</MenuItem>
        {supervisorOptions.map((employee) => (
          <MenuItem key={employee.id} value={employee.id}>
            {employee.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Servico"
        value={filters.serviceOrderId}
        onChange={(event) => updateFilter("serviceOrderId", event.target.value)}
        size="small"
        fullWidth
      >
        <MenuItem value="">Todos os servicos</MenuItem>
        {serviceOptions.map((order) => (
          <MenuItem key={order.id} value={order.id}>
            {serviceName(order)} - {order.customerName}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Local"
        placeholder="Bairro, cidade ou endereco"
        value={filters.location}
        onChange={(event) => updateFilter("location", event.target.value)}
        size="small"
        fullWidth
      />

      <TextField
        label="Nome do cliente"
        placeholder="Digite o nome"
        value={filters.customer}
        onChange={(event) => updateFilter("customer", event.target.value)}
        size="small"
        fullWidth
      />

      <Button onClick={resetFilters} variant="outlined" fullWidth disabled={activeFilterCount === 0}>
        Limpar filtros
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <PhotoLibraryRoundedIcon color="primary" />
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
              Galeria
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            Todas as midias das ordens de servico em um so lugar. Os registros mais recentes ficam em destaque para a equipe encontrar rapido o que acabou de chegar.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<FilterAltRoundedIcon />}
          onClick={() => setFilterDialogOpen(true)}
          sx={{ display: { xs: "inline-flex", md: "none" } }}
        >
          Filtrar midias
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, gap: 2.5, alignItems: "start" }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 3,
            display: { xs: "none", md: "block" },
            position: { md: "sticky" },
            top: { md: 88 },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <FilterAltRoundedIcon color="primary" />
            <Typography fontWeight={900}>Filtros da galeria</Typography>
          </Stack>
          {filterControls}
        </Paper>

        <Stack spacing={3} minWidth={0}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, md: 2 },
              borderRadius: 3,
              background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08), rgba(14, 165, 233, 0.08))",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
              <Box>
                <Typography fontWeight={900}>Amostra recente</Typography>
                <Typography variant="body2" color="text.secondary">
                  Ultimas midias enviadas pela operacao.
                </Typography>
              </Box>
              <Chip label={`${photos.length} midias no total`} color="primary" variant="outlined" />
            </Stack>

            {recentPhotos.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <CleaningServicesRoundedIcon sx={{ fontSize: 38, color: "text.secondary", mb: 1 }} />
                <Typography fontWeight={850}>Nenhuma midia cadastrada ainda.</Typography>
                <Typography color="text.secondary">Quando a equipe enviar fotos ou videos pelo checklist, eles aparecem aqui.</Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: `repeat(${recentPhotos.length}, minmax(220px, 82vw))`,
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  overflowX: { xs: "auto", sm: "visible" },
                  pb: { xs: 0.5, sm: 0 },
                  scrollSnapType: { xs: "x mandatory", sm: "none" },
                }}
              >
                {recentPhotos.map((photo) => (
                  <Box key={photo.id} sx={{ scrollSnapAlign: "start" }}>
                    <PhotoCard photo={photo} compact onOpen={setSelectedPhoto} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Todas as midias
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredPhotos.length} resultado(s) encontrado(s)
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {activeFilterCount === 0 ? (
                <Chip size="small" label="Sem filtros ativos" />
              ) : (
                <>
                  <Chip size="small" color="primary" label={`${activeFilterCount} filtro(s)`} />
                  <Chip size="small" label="Limpar" onClick={resetFilters} />
                </>
              )}
            </Stack>
          </Stack>

          {filteredPhotos.length === 0 ? (
            <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderRadius: 3 }}>
              <PhotoLibraryRoundedIcon sx={{ fontSize: 42, color: "text.secondary", mb: 1 }} />
              <Typography variant="h6">Nenhuma midia encontrada</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Ajuste os filtros para ampliar o resultado.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.7,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {filteredPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onOpen={setSelectedPhoto} />
              ))}
            </Box>
          )}
        </Stack>
      </Box>

      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          Filtrar midias
          <IconButton
            aria-label="Fechar filtros"
            onClick={() => setFilterDialogOpen(false)}
            sx={{ position: "absolute", right: 12, top: 10 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>{filterControls}</DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialogOpen(false)} variant="contained" fullWidth={isMobile}>
            Ver resultados
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedPhoto)} onClose={() => setSelectedPhoto(null)} fullWidth maxWidth="md">
        {selectedPhoto && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              {selectedPhoto.order?.customerName ?? "Midia da obra"}
              <IconButton
                aria-label="Fechar midia"
                onClick={() => setSelectedPhoto(null)}
                sx={{ position: "absolute", right: 12, top: 10 }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <GalleryMediaPreview
                  media={selectedPhoto}
                  alt={photoAlt(selectedPhoto)}
                  controls={isVideoMedia(selectedPhoto)}
                  sx={{
                    width: "100%",
                    maxHeight: { xs: "58vh", md: "68vh" },
                    objectFit: "contain",
                    borderRadius: 2,
                    bgcolor: "action.hover",
                  }}
                />

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Servico
                    </Typography>
                    <Typography fontWeight={850}>{serviceName(selectedPhoto.order)}</Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Supervisor
                    </Typography>
                    <Typography fontWeight={850}>{selectedPhoto.supervisor?.name ?? "Sem supervisor"}</Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Data
                    </Typography>
                    <Typography fontWeight={850}>{formatDate(selectedPhoto.createdAt)}</Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Etapa
                    </Typography>
                    <Box sx={{ mt: 0.4 }}>
                      <StatusChip value={selectedPhoto.type} />
                    </Box>
                  </Paper>
                </Box>

                <Divider />

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Local
                  </Typography>
                  <Typography fontWeight={750}>{selectedPhoto.order?.address ?? "Local nao informado"}</Typography>
                </Stack>

                {selectedPhoto.checklistItem && (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Item do checklist
                    </Typography>
                    <Typography fontWeight={750}>{selectedPhoto.checklistItem.title}</Typography>
                  </Stack>
                )}

                {selectedPhoto.caption && (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Descricao
                    </Typography>
                    <Typography>{selectedPhoto.caption}</Typography>
                  </Stack>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
