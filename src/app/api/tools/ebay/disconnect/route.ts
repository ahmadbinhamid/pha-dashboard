import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const RT_COOKIE = "ebay_uploader_rt";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(RT_COOKIE);
  return NextResponse.json({ ok: true });
}
