import { collectionHandlers } from "@/lib/api-handlers";

const handlers = collectionHandlers("leads", "leads");

export const GET = handlers.GET;
export const POST = handlers.POST;
