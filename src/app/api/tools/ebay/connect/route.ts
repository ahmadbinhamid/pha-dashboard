import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isEbayOAuthConfigured } from "@/services/ebay/env";
import { buildUserAuthorizationUrl } from "@/services/ebay/oauthServer";

export async function GET() {
  if (!isEbayOAuthConfigured()) {
    return NextResponse.json(
      { error: "EBAY_NOT_CONFIGURED", message: "Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REDIRECT_URI." },
      { status: 501 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("ebay_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const url = buildUserAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
