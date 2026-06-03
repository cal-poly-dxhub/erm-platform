export function parseLambdaResponseBody(raw: string): Record<string, unknown> {
  let data: Record<string, unknown> = raw ? JSON.parse(raw) : {};

  // Unwrap Lambda proxy / API Gateway (may be nested)
  for (let i = 0; i < 3; i++) {
    const body = data?.body;
    if (typeof body === "string" && body.trim()) {
      try {
        data = JSON.parse(body) as Record<string, unknown>;
        continue;
      } catch {
        break;
      }
    }
    if (body && typeof body === "object") {
      data = body as Record<string, unknown>;
      continue;
    }
    break;
  }

  return data;
}
