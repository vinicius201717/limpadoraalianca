import { collectionHandlers } from "@/lib/api-handlers";

const handlers = collectionHandlers("quotes", "quotes");

export const GET = handlers.GET;
export const POST = handlers.POST;
