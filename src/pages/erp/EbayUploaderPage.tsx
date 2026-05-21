import { Suspense } from "react";
import { EbayUploaderClient } from "@/modules/ebay-uploader/components/EbayUploaderClient";

export default function EbayUploaderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg/60">Loading tool…</p>}>
      <EbayUploaderClient />
    </Suspense>
  );
}
