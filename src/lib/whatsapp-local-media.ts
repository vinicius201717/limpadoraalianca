import "server-only";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const MAX_BYTES = 16 * 1024 * 1024;
const defaultDirectory = () => resolve(process.cwd(), ".private", "whatsapp");

async function mediaPath(id: string, directory: string) {
  if (process.env.VERCEL) throw new Error("Local media requires persistent server storage.");
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid media identifier.");
  const root = resolve(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (relative(root, await realpath(root)) !== "") throw new Error("Media directory cannot use symbolic links.");
  return join(root, id);
}

export async function writeLocalMedia(id: string, bytes: Buffer, directory = defaultDirectory()) {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Invalid media size.");
  const target = await mediaPath(id, directory);
  const temporary = target + "." + randomUUID() + ".part";
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}

export async function readLocalMedia(id: string, directory = defaultDirectory()) {
  const target = await mediaPath(id, directory);
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || !info.size || info.size > MAX_BYTES) throw new Error("Invalid private media file.");
  // Private uploads are runtime data, never part of the deployment bundle.
  const bytes = await readFile(/* turbopackIgnore: true */ target);
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("Invalid media size.");
  return bytes;
}
