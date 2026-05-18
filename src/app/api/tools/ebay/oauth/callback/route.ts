import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/services/ebay/oauthServer";

const RT_COOKIE = "ebay_uploader_rt";
const RT_MAX_AGE = 60 * 60 * 24 * 120;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const cookieStore = await cookies();
  const expected = cookieStore.get("ebay_oauth_state")?.value;
  cookieStore.delete("ebay_oauth_state");

  if (err) {
    return NextResponse.redirect(new URL(`/tools/ebay-uploader?ebay_error=${encodeURIComponent(err)}`, request.url));
  }
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      new URL(`/tools/ebay-uploader?ebay_error=${encodeURIComponent("Invalid OAuth state — try connecting again.")}`, request.url),
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(
          `/tools/ebay-uploader?ebay_error=${encodeURIComponent("eBay did not return a refresh token — check app scopes and consent.")}`,
          request.url,
        ),
      );
    }
    cookieStore.set(RT_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: RT_MAX_AGE,
      path: "/",
    });
    return NextResponse.redirect(new URL("/tools/ebay-uploader?ebay=connected", request.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    return NextResponse.redirect(new URL(`/tools/ebay-uploader?ebay_error=${encodeURIComponent(msg)}`, request.url));
  }
}
