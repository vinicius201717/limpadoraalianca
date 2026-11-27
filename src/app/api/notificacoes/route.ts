import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { notificationFeed, markSystemNotices } from "@/lib/system-notifications";
const schema = z.discriminatedUnion("action",[
  z.object({action:z.literal("read"),ids:z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(100)}).strict(),
  z.object({action:z.literal("read-all")}).strict(),
]);
export const GET = withDatabase(async request => {
  const auth = await requireApiUser(request); if(auth.response)return auth.response;
  return Response.json(notificationFeed(auth.user));
});
export const POST = withDatabase(async request => {
  const auth = await requireApiUser(request); if(auth.response)return auth.response;
  const input = schema.safeParse(await request.json()); if(!input.success)return Response.json({message:"Dados inválidos."},{status:400});
  markSystemNotices(auth.user,input.data.action==="read-all"?"all":input.data.ids);
  return Response.json(notificationFeed(auth.user));
});
