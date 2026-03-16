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

  if (body.partner && body.partner !== "onio") {
    return NextResponse.json(
      {
        error: "This simulator is configured for partner `onio` only",
      },
      { status: 400 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const payload = {
    partner: "onio",
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

  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signatureSegment = toBase64Url(
    createHmac("sha256", getEmbedSecret()).update(payloadSegment).digest(),
  );

  return NextResponse.json({
    token: `${payloadSegment}.${signatureSegment}`,
  });
}
