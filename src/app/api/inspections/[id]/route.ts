import { itemHandlers } from "@/lib/api-handlers";

const handlers = itemHandlers("inspections", "inspection");

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
