import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";

export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (auth.user.role === "COLABORADOR") return Response.json({ message: "Sem acesso." }, { status: 403 });
  const all = ["OWNER", "GERENTE"].includes(auth.user.role);
  return Response.json({ reports: db.staffAttendanceReports
    .filter((item) => all || item.reportedByUserId === auth.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200) });
});
