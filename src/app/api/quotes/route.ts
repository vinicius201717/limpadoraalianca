import { withDatabase } from "@/lib/with-database";
import { commercialCollection } from "@/lib/commercial-handlers";

const handlers = commercialCollection("orcamentos");
const GETHandler = handlers.GET;
const POSTHandler = handlers.POST;

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
