import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import { AppShell } from "@/components/AppShell";
import { AppThemeProvider } from "@/components/AppThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aliança Limpeza e Restauração",
  description: "Sistema interno para limpeza, restauracao de pisos e operacao de obras.",
  icons: {
    icon: "/logo-alianca.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider>
          <AppThemeProvider>
            <AppShell>{children}</AppShell>
          </AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
