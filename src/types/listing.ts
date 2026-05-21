export type ListingQueueStatus = "queued" | "published" | "error";
export type ListingQueueType = "bundle" | "product";

export type ListingQueueItem = {
  id: string;
  type: ListingQueueType;
  title: string;
  sku?: string;
  refId?: string;
  status: ListingQueueStatus;
  createdAt: string;
};
