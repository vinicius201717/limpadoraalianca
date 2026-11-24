export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Button, Paper, Typography } from "@mui/material";

import { formatCurrency } from "@/lib/format";
import { PaymentsView } from "@/components/PaymentsView";
import { FinanceView } from "@/components/FinanceView";
import { getCurrentUser } from "@/lib/auth";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, getAccessibleServiceOrders } from "@/lib/store";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user || !canViewServiceOrderFinancials(user)) notFound();
  return (
    <><Paper variant="outlined" sx={{p:2,mb:2}}><Typography fontWeight={800}>Despesas administrativas</Typography><Typography variant="h5">{formatCurrency(db.administrativeExpenses.reduce((sum,e)=>sum+e.amount,0))}</Typography><Typography variant="body2" color="text.secondary">Custos sem obra, registrados pelos comprovantes digitais. Não compõem o custo individual das obras.</Typography></Paper><Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}><Button component={Link} href="/financeiro/comprovantes" color="success" variant="contained">Comprovantes recebidos pelo PWA</Button></Box><FinanceView
      initialOrders={getAccessibleServiceOrders(user)}
      employees={db.employees.filter((employee) => employee.status === "ACTIVE")}
      initialExpenses={db.serviceExpenses}
    /><PaymentsView initialPayments={db.servicePayments} orders={getAccessibleServiceOrders(user).map((order) => ({ id: order.id, title: order.title }))} /></>
  );
}
