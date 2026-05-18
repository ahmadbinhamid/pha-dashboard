import { ebayApiBase, ebayAuthBase, ebayClientId, ebayClientSecret, ebayRedirectUri } from "@/services/ebay/env";

const SELL_INVENTORY_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.inventory";

export function buildUserAuthorizationUrl(state: string): string {
  const cid = ebayClientId();
  const redir = ebayRedirectUri();
  if (!cid || !redir) {
    throw new Error("EBAY_CLIENT_ID and EBAY_REDIRECT_URI must be set.");
  }
  const scope = encodeURIComponent(SELL_INVENTORY_SCOPE);
  return `${ebayAuthBase()}/oauth2/authorize?client_id=${encodeURIComponent(cid)}&response_type=code&redirect_uri=${encodeURIComponent(redir)}&scope=${scope}&state=${encodeURIComponent(state)}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
};

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const cid = ebayClientId();
  const secret = ebayClientSecret();
  const redir = ebayRedirectUri();
  if (!cid || !secret || !redir) {
    throw new Error("eBay OAuth credentials are incomplete.");
  }
  const tokenUrl = `${ebayApiBase()}/identity/v1/oauth2/token`;
  const basic = Buffer.from(`${cid}:${secret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token endpoint ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: ebayRedirectUri()!,
  });
  return postToken(body);
}

export async function refreshUserAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SELL_INVENTORY_SCOPE,
  });
  return postToken(body);
}
