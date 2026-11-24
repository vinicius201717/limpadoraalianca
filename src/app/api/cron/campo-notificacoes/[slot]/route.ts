import { GET as dispatch } from "../route";
export const maxDuration=60;
export const dynamic="force-dynamic";
// No work is attempted until the deployment has its push credentials.
export async function GET(request:Request){
  if(!process.env.CRON_SECRET||!process.env.FIELD_VAPID_PUBLIC_KEY||!process.env.FIELD_VAPID_PRIVATE_KEY||!process.env.FIELD_VAPID_SUBJECT)return new Response(null,{status:204});
  return dispatch(request);
}
