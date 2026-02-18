import { createHmac, timingSafeEqual } from "crypto";

type SignedEnvelope<T> = {
  exp: number;
  payload: T;
};

const toBase64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padding), "base64");
};

const getSigningSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET");
  }
  return secret;
};

const sign = (data: string) =>
  toBase64Url(
    createHmac("sha256", getSigningSecret()).update(data).digest()
  );

export function issueSignedToken<T>(payload: T, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const envelope: SignedEnvelope<T> = {
    exp: now + ttlSeconds,
    payload,
  };
  const encoded = toBase64Url(JSON.stringify(envelope));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySignedToken<T>(token: string): T | null {
  const [encoded, receivedSignature] = token.split(".");
  if (!encoded || !receivedSignature) {
    return null;
  }

  const expectedSignature = sign(encoded);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const envelope = JSON.parse(
      fromBase64Url(encoded).toString("utf-8")
    ) as SignedEnvelope<T>;
    if (!envelope?.exp || envelope.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return envelope.payload;
  } catch {
    return null;
  }
}
