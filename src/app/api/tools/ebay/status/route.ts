import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ebayPublishDryRun,
  isEbayLivePublishConfigured,
  isEbayOAuthConfigured,
} from "@/services/ebay/env";

const RT_COOKIE = "ebay_uploader_rt";

export async function GET() {
  const cookieStore = await cookies();
  const connected = Boolean(cookieStore.get(RT_COOKIE)?.value);
  return NextResponse.json({
    oauthConfigured: isEbayOAuthConfigured(),
    livePublishConfigured: isEbayLivePublishConfigured(),
    dryRun: ebayPublishDryRun(),
    connected,
  });
}
