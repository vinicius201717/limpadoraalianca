import { withDatabase } from "@/lib/with-database";
import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { customerOptions } from "@/lib/customer-options";
import { db } from "@/lib/store";

export const GET = withDatabase(async request => {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canAccessAllServiceOrders(auth.user.role)) return Response.json({message:"Acesso restrito."},{status:403});
  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.length > 150) return Response.json({message:"Pesquisa muito longa."},{status:400});
  return Response.json({customers:customerOptions(db.customers,query)});
});
