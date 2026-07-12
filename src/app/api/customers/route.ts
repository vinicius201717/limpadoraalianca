import { collectionHandlers } from "@/lib/api-handlers";

const handlers = collectionHandlers("customers", "customers");

export const GET = handlers.GET;
export const POST = handlers.POST;
