import "server-only";

import { LocalStorageProvider } from "./local-provider";
import type { StorageProvider } from "./types";

let provider: StorageProvider | null = null;

export function getStorageProvider() {
  if (!provider) provider = new LocalStorageProvider();
  return provider;
}

export type { StorageProvider, UploadedFile } from "./types";
