import { withDatabase } from "@/lib/with-database";
import { commercialItem } from "@/lib/commercial-handlers";

const handlers = commercialItem("clientes");
const GETHandler = handlers.GET;
const PATCHHandler = handlers.PATCH;
const DELETEHandler = handlers.DELETE;

export const GET = withDatabase(GETHandler);
export const PATCH = withDatabase(PATCHHandler);
export const DELETE = withDatabase(DELETEHandler);
