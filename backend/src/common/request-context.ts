import type { Request } from 'express';

export function getRequestIdFromContext(req?: Request): string | undefined {
  if (!req) return undefined;
  const header = req.headers?.['x-request-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const tagged = (req as Request & { requestId?: string }).requestId;
  return tagged?.trim() || undefined;
}
