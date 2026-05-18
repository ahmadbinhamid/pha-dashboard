"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { buttonClassName } from "@/components/ui/button-styles";
import { useToast } from "@/components/toast/toast-provider";
import type { EbayUploaderFormPayload, VehicleFitmentRow } from "@/services/ebay/types";
import {
  DEFAULT_FORM,
  EBAY_UPLOADER_DRAFT_KEY,
  EBAY_UPLOADER_LAST_KEY,
  conditionOptions,
  emptyFitmentRow,
  suggestTitle,
} from "@/modules/ebay-uploader/constants";

type LocalImage = { id: string; file: File; url: string };
type Step = 1 | 2 | 3;

type ApiStatus = {
  oauthConfigured: boolean;
  livePublishConfigured: boolean;
  dryRun: boolean;
  connected: boolean;
};

function parseUrlLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\//i.test(s));
}

export function EbayUploaderClient() {
  const formId = useId();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<EbayUploaderFormPayload>(DEFAULT_FORM);
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/tools/ebay/status", { cache: "no-store" });
      const j = (await res.json()) as ApiStatus;
      setApiStatus(j);
    } catch {
      setApiStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refreshStatus();
    });
  }, [refreshStatus]);

  useEffect(() => {
    const ebay = searchParams.get("ebay");
    const err = searchParams.get("ebay_error");
    if (ebay === "connected") {
      toast({ tone: "success", title: "eBay connected", description: "You can publish when the form is complete." });
      startTransition(() => {
        void refreshStatus();
      });
    }
    if (err) {
      toast({ tone: "danger", title: "eBay connection failed", description: err });
    }
  }, [searchParams, toast, refreshStatus]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EBAY_UPLOADER_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { form?: EbayUploaderFormPayload; imageUrlsText?: string };
      startTransition(() => {
        if (d.form) {
          setForm({
            ...DEFAULT_FORM,
            ...d.form,
            fitmentRows: d.form.fitmentRows?.length ? d.form.fitmentRows : DEFAULT_FORM.fitmentRows,
          });
        }
        if (typeof d.imageUrlsText === "string") setImageUrlsText(d.imageUrlsText);
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          EBAY_UPLOADER_DRAFT_KEY,
          JSON.stringify({ form, imageUrlsText }),
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [form, imageUrlsText]);

  useEffect(() => {
    return () => {
      localImages.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, [localImages]);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      toast({ tone: "warning", title: "No images", description: "Choose image files (PNG, JPG, WebP)." });
      return;
    }
    setLocalImages((prev) => {
      const next = files.map((file) => ({
        id: crypto.randomUUID?.() ?? `${Date.now()}-${file.name}`,
        file,
        url: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeLocal = (id: string) => {
    setLocalImages((prev) => {
      const hit = prev.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((x) => x.id !== id);
    });
  };

  const moveLocal = (id: string, dir: -1 | 1) => {
    setLocalImages((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
      return copy;
    });
  };

  const patchForm = (patch: Partial<EbayUploaderFormPayload>) => setForm((f) => ({ ...f, ...patch }));

  const patchRow = (id: string, patch: Partial<VehicleFitmentRow>) => {
    setForm((f) => ({
      ...f,
      fitmentRows: f.fitmentRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const imageUrlsMerged = useMemo(() => {
    const fromText = parseUrlLines(imageUrlsText);
    const uniq = new Set(fromText);
    return [...uniq];
  }, [imageUrlsText]);

  const loadLastPublished = () => {
    try {
      const raw = localStorage.getItem(EBAY_UPLOADER_LAST_KEY);
      if (!raw) {
        toast({ tone: "default", title: "Nothing saved yet", description: "Publish once to store a reusable snapshot." });
        return;
      }
      const d = JSON.parse(raw) as { form: EbayUploaderFormPayload; imageUrlsText?: string };
      setForm({ ...DEFAULT_FORM, ...d.form, fitmentRows: d.form.fitmentRows?.length ? d.form.fitmentRows : [emptyFitmentRow()] });
      if (typeof d.imageUrlsText === "string") setImageUrlsText(d.imageUrlsText);
      toast({ tone: "success", title: "Loaded last listing", description: "Review fields before publishing again." });
    } catch {
      toast({ tone: "danger", title: "Could not load", description: "Stored snapshot may be invalid." });
    }
  };

  const applyTitleSuggestion = () => {
    const t = suggestTitle(form);
    if (t) patchForm({ title: t });
    else toast({ tone: "default", title: "Add brand or OEM", description: "We use those to build a title suggestion." });
  };

  const validateStep1 = () => {
    if (!localImages.length && !imageUrlsMerged.length) {
      toast({
        tone: "default",
        title: "No images yet",
        description: "You can continue — add HTTPS URLs before a live publish, or use dry-run to test the flow.",
      });
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.title.trim() || !form.sku.trim()) {
      toast({ tone: "warning", title: "Required fields", description: "Title and SKU are required." });
      return false;
    }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
      toast({ tone: "warning", title: "Price", description: "Enter a valid price." });
      return false;
    }
    return true;
  };

  const publish = async () => {
    if (!apiStatus?.connected) {
      toast({ tone: "warning", title: "Connect eBay", description: "Use Connect eBay before publishing." });
      return;
    }
    if (!validateStep2()) return;
    if (!apiStatus.dryRun && imageUrlsMerged.length === 0) {
      toast({
        tone: "warning",
        title: "Public image URLs required",
        description:
          "Live listings need HTTPS image URLs eBay can fetch. Add them in step 1, or run a dry-run (default) without URLs.",
      });
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/tools/ebay/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, imageUrls: imageUrlsMerged }),
      });
      const data = (await res.json()) as
        | { ok: true; dryRun?: boolean; sku?: string; warnings?: string[] }
        | { ok: false; message?: string; code?: string }
        | { error?: string; message?: string };
      if (!res.ok) {
        toast({
          tone: "danger",
          title: "Publish failed",
          description: "message" in data ? data.message : `HTTP ${res.status}`,
        });
        return;
      }
      if ("ok" in data && data.ok) {
        toast({
          tone: "success",
          title: data.dryRun ? "Dry run OK" : "Published to eBay",
          description: data.dryRun
            ? (data.warnings?.[0] ?? "No live API calls were made (EBAY_PUBLISH_DRY_RUN).")
            : `SKU ${data.sku ?? form.sku} — check your eBay seller hub.`,
        });
        try {
          localStorage.setItem(EBAY_UPLOADER_LAST_KEY, JSON.stringify({ form, imageUrlsText }));
        } catch {
          /* ignore */
        }
      } else if ("ok" in data && data.ok === false) {
        toast({ tone: "danger", title: data.code ?? "eBay error", description: data.message ?? "Listing was not created." });
      } else {
        toast({ tone: "danger", title: "Unexpected response", description: "Try again." });
      }
    } catch (e) {
      toast({ tone: "danger", title: "Network error", description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setPublishing(false);
    }
  };

  const disconnect = async () => {
    await fetch("/api/tools/ebay/disconnect", { method: "POST" });
    await refreshStatus();
    toast({ tone: "default", title: "Disconnected", description: "eBay tokens cleared in this browser session." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-fg/60">
            <Link href="/dashboard" className="text-accent hover:underline">
              Dashboard
            </Link>
            <span className="px-1.5 text-fg/40">/</span>
            <span className="text-fg/75">eBay uploader</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg">eBay listing uploader</h1>
          <p className="mt-1 max-w-3xl text-sm text-fg/70">
            Internal tool only — rapid drafts for eBay. Flow: images → details → publish. Does not change ERP inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={loadLastPublished}>
            Duplicate last
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={applyTitleSuggestion}>
            Suggest title
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="eBay connection"
          description="OAuth tokens are stored in an httpOnly cookie for this browser (rotate keys in production)."
        />
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-fg/70">
            {loadingStatus ? (
              "Checking configuration…"
            ) : apiStatus ? (
              <ul className="list-inside list-disc space-y-1">
                <li>OAuth env: {apiStatus.oauthConfigured ? "configured" : "missing"}</li>
                <li>Account: {apiStatus.connected ? "connected" : "not connected"}</li>
                <li>Live publish: {apiStatus.livePublishConfigured ? "ready" : "dry-run or incomplete env"}</li>
              </ul>
            ) : (
              "Could not load status."
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {apiStatus?.oauthConfigured ? (
              <a href="/api/tools/ebay/connect" className={buttonClassName({ variant: "primary", size: "sm", className: "inline-flex" })}>
                Connect eBay
              </a>
            ) : null}
            {apiStatus?.connected ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => void refreshStatus()}>
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-2/30 px-3 py-2 text-xs font-semibold text-fg/60">
        <span className={step === 1 ? "text-accent" : ""}>1 · Images</span>
        <Icons.ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
        <span className={step === 2 ? "text-accent" : ""}>2 · Details</span>
        <Icons.ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
        <span className={step === 3 ? "text-accent" : ""}>3 · Publish</span>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader title="Step 1 — Images" description="Drag & drop previews, reorder, and add HTTPS URLs eBay can fetch for live listings." />
          <CardContent className="space-y-6">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg-2/40 px-4 py-14 text-center transition hover:border-accent/40 hover:bg-accent/5"
            >
              <Icons.Upload className="h-8 w-8 text-fg/40" />
              <p className="mt-3 text-sm font-medium text-fg">Drop images here or click to browse</p>
              <p className="mt-1 text-xs text-fg/55">Local previews — reorder with arrows. eBay still needs public URLs below.</p>
            </div>

            {localImages.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {localImages.map((img, idx) => (
                  <li key={img.id} className="group relative overflow-hidden rounded-xl border border-border bg-bg shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1 py-1 opacity-0 transition group-hover:opacity-100">
                      <Button type="button" variant="secondary" size="sm" className="h-7 px-1" onClick={() => moveLocal(img.id, -1)} disabled={idx === 0}>
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-1"
                        onClick={() => moveLocal(img.id, 1)}
                        disabled={idx === localImages.length - 1}
                      >
                        ↓
                      </Button>
                      <Button type="button" variant="secondary" size="sm" className="h-7 px-1 text-danger" onClick={() => removeLocal(img.id)}>
                        <Icons.Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-fg" htmlFor={`${formId}-urls`}>
                Public image URLs (HTTPS, one per line)
              </label>
              <textarea
                id={`${formId}-urls`}
                value={imageUrlsText}
                onChange={(e) => setImageUrlsText(e.target.value)}
                rows={5}
                placeholder={"https://cdn.example.com/part-1.jpg\nhttps://cdn.example.com/part-2.jpg"}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              />
              <p className="mt-2 text-xs text-fg/55">
                Parsed {imageUrlsMerged.length} URL(s). eBay Inventory API requires images it can download over HTTPS.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="primary" onClick={() => validateStep1() && setStep(2)}>
                Next: details
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader title="Step 2 — Part details" description="Minimal fields for a fixed-price Motors-style listing." />
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Product title</label>
                <Input value={form.title} onChange={(e) => patchForm({ title: e.target.value })} placeholder="OEM front brake pads — W205" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">SKU</label>
                <Input value={form.sku} onChange={(e) => patchForm({ sku: e.target.value })} className="font-mono" placeholder="PPG-…" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">OEM number</label>
                <Input value={form.oemNumber} onChange={(e) => patchForm({ oemNumber: e.target.value })} placeholder="A0004211010" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Brand</label>
                <Input value={form.brand} onChange={(e) => patchForm({ brand: e.target.value })} placeholder="Mercedes-Benz" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Condition</label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  value={form.condition}
                  onChange={(e) => patchForm({ condition: e.target.value as EbayUploaderFormPayload["condition"] })}
                >
                  {conditionOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Price</label>
                <Input value={form.price} onChange={(e) => patchForm({ price: e.target.value })} inputMode="decimal" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Quantity</label>
                <Input value={form.quantity} onChange={(e) => patchForm({ quantity: e.target.value })} inputMode="numeric" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">eBay category ID (optional)</label>
                <Input
                  value={form.ebayCategoryId ?? ""}
                  onChange={(e) => patchForm({ ebayCategoryId: e.target.value })}
                  placeholder="Defaults from EBAY_DEFAULT_CATEGORY_ID"
                  className="font-mono text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  placeholder="Fitment, warranty, shipping notes…"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-2/30 p-4">
              <div className="text-sm font-semibold text-fg">Vehicle compatibility</div>
              <p className="mt-1 text-xs text-fg/55">Structured rows and/or free text — appended to the eBay description.</p>
              <div className="mt-3 space-y-2">
                {form.fitmentRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Input placeholder="Make" value={row.make} onChange={(e) => patchRow(row.id, { make: e.target.value })} />
                    <Input placeholder="Model" value={row.model} onChange={(e) => patchRow(row.id, { model: e.target.value })} />
                    <Input placeholder="Year" value={row.year} onChange={(e) => patchRow(row.id, { year: e.target.value })} />
                    <Input placeholder="Engine" value={row.engine} onChange={(e) => patchRow(row.id, { engine: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => patchForm({ fitmentRows: [...form.fitmentRows, emptyFitmentRow()] })}>
                  Add row
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    patchForm({
                      fitmentRows: form.fitmentRows.length > 1 ? form.fitmentRows.slice(0, -1) : form.fitmentRows,
                    })
                  }
                >
                  Remove last row
                </Button>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg/50">Manual compatibility</label>
                <textarea
                  value={form.compatibilityText}
                  onChange={(e) => patchForm({ compatibilityText: e.target.value })}
                  rows={3}
                  placeholder={"Toyota Hilux 2018-2022\nFord Ranger PX2"}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" variant="primary" onClick={() => validateStep2() && setStep(3)}>
                Next: publish
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader title="Step 3 — Publish" description="Calls the server-side eBay Inventory flow (dry-run by default)." />
          <CardContent className="space-y-4">
            <ul className="text-sm text-fg/70 space-y-1 list-disc list-inside">
              <li>Title: {form.title || "—"}</li>
              <li>SKU: {form.sku || "—"}</li>
              <li>Price: {form.price || "—"}</li>
              <li>Public images: {imageUrlsMerged.length}</li>
              <li>Local previews: {localImages.length}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" variant="primary" disabled={publishing} onClick={() => void publish()}>
                {publishing ? "Publishing…" : "Publish to eBay"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
