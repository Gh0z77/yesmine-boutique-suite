import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Payme calls this endpoint with JSON-RPC and Basic auth. The route is a thin
 * proxy on purpose: the merchant key stays inside the database, and
 * `payme_rpc` verifies the credentials itself before touching an order. That
 * keeps the secret out of the web tier entirely.
 */
async function handlePayme(request: Request): Promise<Response> {
  const json = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status: 200, // the protocol carries its own errors in the body
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  if (request.method !== "POST") {
    return json({ error: { code: -32300, message: "POST only" } });
  }

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    return json({ error: { code: -32400, message: "Payments are not configured" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: -32700, message: "Parse error" } });
  }

  const response = await fetch(`${url}/rest/v1/rpc/payme_rpc`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({
      p_auth: request.headers.get("authorization") ?? "",
      p_body: body,
    }),
  });

  if (!response.ok) {
    console.error("payme_rpc failed", response.status, await response.text());
    return json({ error: { code: -32400, message: "Internal error" } });
  }
  return json(await response.json());
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (new URL(request.url).pathname === "/api/payme") {
        return await handlePayme(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
