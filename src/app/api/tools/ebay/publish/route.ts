import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createEbayListing } from "@/services/ebay/createListing";
import type { EbayUploaderFormPayload } from "@/services/ebay/types";
import { refreshUserAccessToken } from "@/services/ebay/oauthServer";

const RT_COOKIE = "ebay_uploader_rt";

type PublishBody = {
  form: EbayUploaderFormPayload;
  imageUrls: string[];
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const rt = cookieStore.get(RT_COOKIE)?.value;
  if (!rt) {
    return NextResponse.json({ error: "not_connected", message: "Connect your eBay account first." }, { status: 401 });
  }

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.form || typeof body.form !== "object") {
    return NextResponse.json({ error: "validation", message: "Missing form payload." }, { status: 400 });
  }

  try {
    const tokens = await refreshUserAccessToken(rt);
    const result = await createEbayListing({
      accessToken: tokens.access_token,
      form: body.form,
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ ok: false, code: "TOKEN_OR_NETWORK", message }, { status: 502 });
  }
}
