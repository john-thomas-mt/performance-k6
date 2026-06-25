import http, { RefinedResponse, ResponseType } from "k6/http";
import { check } from "k6";
import encoding from "k6/encoding";
import { config } from "../../config/env.config.ts";
import { buildHeaders } from "./headers.helper.ts";
import { SessionTokens } from "../types/common.type.ts";

type Res = RefinedResponse<ResponseType | undefined>;

function postSignIn(
  username: string,
  password: string,
  version: string,
): Res | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericServer/SignIn`,
    JSON.stringify([username, password, "", false, "", "", [], "1"]),
    {
      headers: buildHeaders(null, version),
      tags: { name: "SignIn" },
    },
  );

  const ok = check(res, {
    "SignIn: status is 201": (r) => r.status === 201,
    "SignIn: response is JSON": (r) =>
      r.headers["Content-Type"]?.includes("application/json") ?? false,
  });

  if (!ok) {
    console.error(
      `[VU ${__VU}] signIn failed for "${username}" — HTTP ${res.status}`,
    );
    return null;
  }

  return res;
}

function extractBearerToken(body: unknown): string | null {
  return Array.isArray(body)
    ? (body.find(
        (item): item is string =>
          typeof item === "string" && /^\d+\|/.test(item),
      ) ?? null)
    : null;
}

export function signIn(
  username: string,
  password: string,
  version: string,
): string | null {
  const res = postSignIn(username, password, version);
  if (!res) return null;

  const token = extractBearerToken(res.json());
  if (!token) {
    console.error(
      `[VU ${__VU}] signIn: could not extract bearer token from response`,
    );
  }

  return token;
}

export function signInSession(
  username: string,
  password: string,
  version: string,
): SessionTokens {
  const res = postSignIn(username, password, version);
  if (!res) return { bearerToken: null, encUserId: null };

  const body = res.json();
  const bearerToken = extractBearerToken(body);
  const encUserId: string | null = Array.isArray(body)
    ? ((body as any[]).find(
        (e) => e && typeof e === "object" && typeof e.EncryptedSN === "string",
      )?.EncryptedSN ?? null)
    : null;

  if (!bearerToken)
    console.error(`[VU ${__VU}] signInSession: could not extract bearer token`);
  if (!encUserId)
    console.error(`[VU ${__VU}] signInSession: could not extract EncryptedSN`);

  return { bearerToken, encUserId };
}

export function maAuthenticate(
  bearerToken: string,
  version: string,
): string | null {
  const res = http.post(
    `${config.baseUrl}/api/MomentusAssistantServer/Authenticate`,
    null,
    {
      headers: buildHeaders(bearerToken, version),
      tags: { name: "MAAuthenticate" },
    },
  );

  const ok = check(res, {
    "MAAuthenticate: status is 201": (r) => r.status === 201,
    "MAAuthenticate: returns JWT array": (r) => {
      try {
        const body = r.json();
        return (
          Array.isArray(body) && body.length > 0 && typeof body[0] === "string"
        );
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(
      `[VU ${__VU}] maAuthenticate failed — HTTP ${res.status}: ${res.body}`,
    );
    return null;
  }

  return (res.json() as string[])[0];
}

export function tenantIdFromJwt(salesAiJwt: string): string {
  const payload = encoding.b64decode(salesAiJwt.split(".")[1], "rawurl", "s");
  const tenantId = (JSON.parse(payload) as { tenant_id?: string }).tenant_id;
  if (!tenantId) {
    throw new Error("tenantIdFromJwt: tenant_id claim missing from sales-ai JWT");
  }
  return tenantId;
}
