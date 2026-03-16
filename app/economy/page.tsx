"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FormState = {
  partner: string;
  sub: string;
  externalTenantId: string;
  externalAccountId: string;
  companyId: string;
  companySlug: string;
  target: string;
  nonce: string;
  returnToPartner: string;
};

type LoggedEvent = {
  id: string;
  timestamp: string;
  origin: string;
  data: string;
};

const MINCFO_BASE_URL = "http://localhost:3000";
const TRUSTED_MESSAGE_ORIGIN = "http://localhost:3000";
const FORM_STORAGE_KEY = "onio-partner-simulator-form";
const PARTNER_TOKEN_API_ROUTE = "/api/mincfo/embed-token";

const initialForm: FormState = {
  partner: "onio",
  sub: "demo-user-1",
  externalTenantId: "demo-tenant-1",
  externalAccountId: "demo-account-1",
  companyId: "",
  companySlug: "",
  target: "/embed/insights",
  nonce: "",
  returnToPartner: "http://localhost:3001/economy",
};

function extractToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const possibleKeys = ["token", "embedToken", "launchToken"];

  for (const key of possibleKeys) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }

  return "";
}

function prettyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function EconomyPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedToken, setMintedToken] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");
  const [lastLaunchUrl, setLastLaunchUrl] = useState("");
  const [iframeInstance, setIframeInstance] = useState(0);
  const [mintResponse, setMintResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [debugNote, setDebugNote] = useState("");
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const iframeUrlRef = useRef("");
  const hasAutoLaunchedRef = useRef(false);
  const hasHydratedFormRef = useRef(false);

  const requestBody = useMemo(
    () => ({
      partner: form.partner,
      sub: form.sub,
      externalTenantId: form.externalTenantId,
      externalAccountId: form.externalAccountId,
      companyId: form.companyId || undefined,
      companySlug: form.companySlug || undefined,
      target: form.target,
      nonce: form.nonce || undefined,
    }),
    [form],
  );

  useEffect(() => {
    iframeUrlRef.current = iframeUrl;
  }, [iframeUrl]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
      if (!stored) {
        hasHydratedFormRef.current = true;
        return;
      }

      const parsed = JSON.parse(stored) as Partial<FormState>;
      setForm((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // Ignore invalid localStorage state and keep defaults.
    } finally {
      hasHydratedFormRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedFormRef.current) {
      return;
    }

    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  function reloadIframeUrl(url: string) {
    if (!url) {
      return;
    }

    setIframeUrl(url);
    setIframeInstance((current) => current + 1);
  }

  function canLaunch(currentForm: FormState) {
    return Boolean(
      currentForm.partner &&
        currentForm.sub &&
        (currentForm.externalTenantId || currentForm.externalAccountId),
    );
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== TRUSTED_MESSAGE_ORIGIN) {
        return;
      }

      setEvents((current) => [
        {
          id: `${Date.now()}-${current.length}`,
          timestamp: new Date().toISOString(),
          origin: event.origin,
          data: prettyValue(event.data),
        },
        ...current,
      ]);

      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data.type === "mincfo:auth-complete"
      ) {
        void mintToken();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [requestBody, form.returnToPartner]);

  useEffect(() => {
    if (!hasHydratedFormRef.current || hasAutoLaunchedRef.current) {
      return;
    }

    if (!canLaunch(form)) {
      hasAutoLaunchedRef.current = true;
      return;
    }

    hasAutoLaunchedRef.current = true;
    setMintedToken("");
    setIframeUrl("");
    setDebugNote("Auto-launched on load");
    void mintToken();
  }, [form, requestBody]);

  useEffect(() => {
    function handlePageReturn() {
      const currentUrl = iframeUrlRef.current;
      if (!currentUrl) {
        return;
      }

      void mintToken();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handlePageReturn();
      }
    }

    window.addEventListener("focus", handlePageReturn);
    window.addEventListener("pageshow", handlePageReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handlePageReturn);
      window.removeEventListener("pageshow", handlePageReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function buildStartUrl(token: string) {
    const params = new URLSearchParams({
      token,
      returnToPartner: form.returnToPartner,
    });

    return `${MINCFO_BASE_URL}/embed/partner/onio/start?${params.toString()}`;
  }

  function buildDirectEmbedUrl(token: string) {
    const separator = form.target.includes("?") ? "&" : "?";
    return `${MINCFO_BASE_URL}${form.target}${separator}token=${encodeURIComponent(token)}`;
  }

  async function mintToken() {
    setIsMinting(true);
    setErrorMessage("");

    try {
      const response = await fetch(PARTNER_TOKEN_API_ROUTE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      setMintResponse(prettyValue(data));

      if (!response.ok) {
        setMintedToken("");
        setIframeUrl("");
        setErrorMessage(prettyValue(data));
        return;
      }

      const token = extractToken(data);
      if (!token) {
        setMintedToken("");
        setIframeUrl("");
        setErrorMessage("Token signing succeeded but no token field was found in the response.");
        return;
      }

      const launchUrl = buildStartUrl(token);
      setMintedToken(token);
      setIframeUrl(launchUrl);
      setLastLaunchUrl(launchUrl);
    } catch (error) {
      setMintedToken("");
      setIframeUrl("");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsMinting(false);
    }
  }

  function relaunchEmbed() {
    void mintToken();
  }

  function clearState() {
    setMintedToken("");
    setIframeUrl("");
    setLastLaunchUrl("");
    setMintResponse("");
    setErrorMessage("");
    setDebugNote("");
    setEvents([]);
  }

  function launchDirectEmbed() {
    if (!mintedToken) {
      setErrorMessage("Mint a token first, then test the direct embed URL.");
      return;
    }

    setErrorMessage("");
    setIframeUrl(buildDirectEmbedUrl(mintedToken));
  }

  function reuseLastLaunchUrl() {
    if (!lastLaunchUrl) {
      setErrorMessage("Launch the embed first to capture a reusable launch URL.");
      return;
    }

    setErrorMessage("");
    setIframeUrl(lastLaunchUrl);
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Economy</h1>
      <p style={{ marginTop: 0 }}>
        Minimal partner-platform simulator that signs MinCFO embed tokens locally and loads
        MinCFO from <code>{MINCFO_BASE_URL}</code>.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {(
          Object.entries(form) as Array<[keyof FormState, string]>
        ).map(([name, value]) => (
          <label
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 12,
              background: "#fff",
              border: "1px solid #ccc",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
            <input
              value={value}
              onChange={(event) => updateField(name, event.target.value)}
              style={{ padding: 8, border: "1px solid #bbb" }}
            />
          </label>
        ))}
      </section>

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={mintToken} disabled={isMinting} style={{ padding: "10px 14px" }}>
          {isMinting ? "Launching..." : "Launch Embed"}
        </button>
        <button onClick={relaunchEmbed} disabled={isMinting} style={{ padding: "10px 14px" }}>
          Relaunch Embed
        </button>
        <button onClick={clearState} style={{ padding: "10px 14px" }}>
          Clear Token + Reset Iframe
        </button>
        <button
          onClick={launchDirectEmbed}
          disabled={!mintedToken}
          style={{ padding: "10px 14px" }}
        >
          Test Direct Embed Launch URL
        </button>
        <button
          onClick={reuseLastLaunchUrl}
          disabled={!lastLaunchUrl}
          style={{ padding: "10px 14px" }}
        >
          Reuse Last Launch URL
        </button>
      </section>

      {errorMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            color: "#7a0000",
            background: "#ffe5e5",
            border: "1px solid #d99",
            whiteSpace: "pre-wrap",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {debugNote ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            color: "#1b4d1b",
            background: "#e8f6e8",
            border: "1px solid #9bc89b",
          }}
        >
          {debugNote}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            minHeight: 640,
            background: "#fff",
            border: "1px solid #ccc",
            padding: 12,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Embedded MinCFO</h2>
          {iframeUrl ? (
            <iframe
              key={`${iframeInstance}:${iframeUrl}`}
              src={iframeUrl}
              title="MinCFO embed simulator"
              style={{ width: "100%", height: 560, border: "1px solid #bbb" }}
            />
          ) : (
            <div
              style={{
                height: 560,
                border: "1px dashed #bbb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                color: "#555",
              }}
            >
              Launch the embed to load MinCFO.
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <DebugPanel title="Signed Token" value={mintedToken || "(none)"} />
          <DebugPanel title="Current Iframe URL" value={iframeUrl || "(none)"} />
          <DebugPanel title="Last Launch URL" value={lastLaunchUrl || "(none)"} />
          <DebugPanel title="Token Request Body" value={prettyValue(requestBody)} />
          <DebugPanel title="Token Response" value={mintResponse || "(none)"} />
          <DebugPanel
            title={`postMessage Events (${events.length})`}
            value={
              events.length
                ? prettyValue(events.map(({ timestamp, origin, data }) => ({ timestamp, origin, data })))
                : "(none)"
            }
          />
        </div>
      </section>
    </main>
  );
}

function DebugPanel({ title, value }: { title: string; value: string }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #ccc",
        padding: 12,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 16 }}>{title}</h2>
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {value}
      </pre>
    </section>
  );
}
