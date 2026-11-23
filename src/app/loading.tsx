import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          bgcolor: "background.paper",
          maxWidth: 760,
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Carregando dados
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preparando a tela com as informacoes atualizadas do sistema.
            </Typography>
          </Box>
          <LinearProgress sx={{ height: 8, borderRadius: 999 }} />
        </Stack>
      </Paper>
    </Box>
  );
}
