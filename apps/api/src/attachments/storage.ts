import { promises as fs } from 'fs';
import { join } from 'path';

/** Pasta onde os comprovantes ficam em disco: uploads/<userId>/<attachmentId>. */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

export const filePath = (userId: string, attachmentId: string) => join(UPLOAD_ROOT, userId, attachmentId);

export async function saveFile(userId: string, attachmentId: string, data: Buffer) {
  await fs.mkdir(join(UPLOAD_ROOT, userId), { recursive: true });
  await fs.writeFile(filePath(userId, attachmentId), data);
}

export async function removeFiles(userId: string, attachmentIds: string[]) {
  await Promise.all(attachmentIds.map((id) => fs.rm(filePath(userId, id), { force: true })));
}

export async function removeUserFolder(userId: string) {
  await fs.rm(join(UPLOAD_ROOT, userId), { recursive: true, force: true });
}
