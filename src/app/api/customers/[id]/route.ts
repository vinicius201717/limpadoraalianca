import { itemHandlers } from "@/lib/api-handlers";

const handlers = itemHandlers("customers", "customer");

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
