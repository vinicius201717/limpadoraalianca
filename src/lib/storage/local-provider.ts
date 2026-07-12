import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, UploadedFile } from "./types";

const publicRoot = path.join(process.cwd(), "public", "uploads");

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export class LocalStorageProvider implements StorageProvider {
  async upload(file: File, targetPath: string): Promise<UploadedFile> {
    const safePath = targetPath
      .split("/")
      .filter(Boolean)
      .map((segment) => safeSegment(segment))
      .join(path.sep);
    const fileName = safeSegment(file.name || "upload.jpg");
    const relativePath = path.join(safePath, `${Date.now()}-${fileName}`);
    const absolutePath = path.join(publicRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    return {
      url: `/uploads/${relativePath.replaceAll(path.sep, "/")}`,
      path: relativePath.replaceAll(path.sep, "/"),
      fileName,
      mimeType: file.type,
      sizeBytes: file.size,
    };
  }

  async remove(targetPath: string) {
    const safePath = targetPath
      .split("/")
      .filter(Boolean)
      .map((segment) => safeSegment(segment))
      .join(path.sep);
    await rm(path.join(publicRoot, safePath), { force: true });
  }
}
