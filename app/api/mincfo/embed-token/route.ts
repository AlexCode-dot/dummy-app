import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const TOKEN_TTL_SECONDS = 5 * 60;

type EmbedTokenRequest = {
  partner?: string;
  sub?: string;
  externalTenantId?: string;
  externalAccountId?: string;
  companyId?: string;
  companySlug?: string;
  target?: string;
  nonce?: string;
};

function toBase64Url(value: string | Buffer) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getEmbedSecret() {
  const secret = process.env.MINCFO_EMBED_SHARED_SECRET;

  if (!secret) {
    throw new Error("MINCFO_EMBED_SHARED_SECRET is not configured");
  }

  return secret;
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

const PARTNER_ID = "dummy-app";

export async function POST(request: Request) {
  const body = (await request.json()) as EmbedTokenRequest;

  if (!body.sub) {
    return NextResponse.json({ error: "`sub` is required" }, { status: 400 });
  }

  if (!body.externalTenantId && !body.externalAccountId) {
    return NextResponse.json(
      {
        error: "At least one of `externalTenantId` or `externalAccountId` is required",
      },
      { status: 400 },
    );
  }

  if (body.partner && body.partner !== PARTNER_ID) {
    return NextResponse.json(
      {
        error: `This simulator is configured for partner \`${PARTNER_ID}\` only`,
      },
      { status: 400 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const payload = {
    partner: PARTNER_ID,
    sub: body.sub,
    externalTenantId: body.externalTenantId || undefined,
    externalAccountId: body.externalAccountId || undefined,
    companyId: body.companyId || undefined,
    companySlug: body.companySlug || undefined,
    target: body.target || undefined,
    nonce,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  console.log("EMBED_PAYLOAD_BEFORE_SIGN", payload);

  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const decodedPayload = decodeBase64UrlJson<typeof payload>(payloadSegment);

  console.log("EMBED_PAYLOAD_SEGMENT_DECODED", decodedPayload);
  console.log("HAS_NONCE_IAT_EXP", {
    hasNonce: Boolean(payload.nonce),
    hasIat: typeof payload.iat === "number",
    hasExp: typeof payload.exp === "number",
  });
  console.log("PARTNER_CHECK", {
    partner: payload.partner,
    ok: payload.partner === PARTNER_ID,
  });
  console.log("EMBED_SECRET_CHECK", {
    configured: Boolean(process.env.MINCFO_EMBED_SHARED_SECRET),
    matchesExpected: process.env.MINCFO_EMBED_SHARED_SECRET === "dev-test-embed-secret",
  });

  const signatureSegment = toBase64Url(
    createHmac("sha256", getEmbedSecret()).update(payloadSegment).digest(),
  );

  return NextResponse.json({
    token: `${payloadSegment}.${signatureSegment}`,
  });
}
