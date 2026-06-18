export function parseLambdaProxyResponse(
  res: Response,
  raw: string,
): { status: number; body: Record<string, unknown> } {
  let envelope: Record<string, unknown> = {};
  try {
    envelope = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return { status: res.status, body: { error: raw || "Invalid upstream response" } };
  }

  const body = parseLambdaResponseBody(raw);
  const envelopeStatus =
    typeof envelope.statusCode === "number" ? envelope.statusCode : undefined;
  const status = !res.ok ? res.status : envelopeStatus ?? res.status;

  return { status, body };
}

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
