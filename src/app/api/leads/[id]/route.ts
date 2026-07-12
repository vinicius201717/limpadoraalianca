import { itemHandlers } from "@/lib/api-handlers";

const handlers = itemHandlers("leads", "lead");

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
