import { Suspense } from "react";
import type { Metadata } from "next";
import { EbayUploaderClient } from "@/modules/ebay-uploader/components/EbayUploaderClient";

export const metadata: Metadata = {
  title: "eBay uploader",
  description: "Internal tool to draft and publish listings to eBay.",
};

export default function EbayUploaderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg/60">Loading tool…</p>}>
      <EbayUploaderClient />
    </Suspense>
  );
}
