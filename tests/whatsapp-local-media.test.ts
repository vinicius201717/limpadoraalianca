import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, rm, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { readLocalMedia, writeLocalMedia } from "../src/lib/whatsapp-local-media";

test("private local media persists atomically and rejects unsafe identifiers", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "alianca-whatsapp-test-"));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith("alianca-whatsapp-test-"));
    await rm(root, { recursive: true, force: true });
  });
  const directory = join(root, "private");
  const id = "a".repeat(64);
  const audio = Buffer.from("OggS private audio");
  await writeLocalMedia(id, audio, directory);
  assert.deepEqual(await readLocalMedia(id, directory), audio);
  await writeLocalMedia(id, audio, directory);
  assert.deepEqual(await readdir(directory), [id]);
  await assert.rejects(writeLocalMedia("../outside", audio, directory));
  await assert.rejects(readLocalMedia("../outside", directory));
  await assert.rejects(writeLocalMedia(id, Buffer.alloc(0), directory));
  await assert.rejects(writeLocalMedia(id, Buffer.alloc(16 * 1024 * 1024 + 1), directory));
  const realDirectory = join(root, "target");
  await mkdir(realDirectory);
  await symlink(realDirectory, join(root, "linked"), "junction");
  await assert.rejects(writeLocalMedia(id, audio, join(root, "linked")));
  assert.deepEqual(await readdir(realDirectory), []);
});

test("local attachments cannot be placed on Vercel ephemeral storage", async () => {
  const before = process.env.VERCEL;
  try {
    process.env.VERCEL = "1";
    await assert.rejects(writeLocalMedia("b".repeat(64), Buffer.from("receipt")), /persistent/);
    await assert.rejects(readLocalMedia("b".repeat(64)), /persistent/);
  } finally {
    if (before === undefined) delete process.env.VERCEL; else process.env.VERCEL = before;
  }
});
