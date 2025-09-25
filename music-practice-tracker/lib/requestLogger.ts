import logger from "./logger";

function generateRequestId(): string {
  const now = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${now}-${rnd}`;
}

export function getRequestIdFrom(req?: Request): string {
  try {
    if (!req) return generateRequestId();
    const id = (req.headers as any)?.get?.("x-request-id") || (req as any)?.headers?.get?.("x-request-id");
    return id || generateRequestId();
  } catch {
    return generateRequestId();
  }
}

export function createRequestLogger(params: { userId?: string | null; requestId?: string } = {}) {
  const { userId, requestId } = params;
  // winston child adds defaultMeta; fallback if child not available
  const base: any = (logger as any);
  if (typeof base.child === "function") {
    return base.child({ userId: userId ?? undefined, requestId: requestId ?? generateRequestId() });
  }
  return logger;
}


