// Meta connect flow: consent first, then a catalog picker if several granted.

export interface MetaConnectUrlResponse {
  url: string;
}

export interface MetaCatalog {
  id: string;
  name: string | null;
}

export interface MetaCatalogsResponse {
  catalogs: MetaCatalog[];
}

export interface MetaCompleteConnectPayload {
  catalogId: string;
}
