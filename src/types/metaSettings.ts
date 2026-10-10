// Meta connect flow: consent first, then the business + catalog picker.

export interface MetaConnectUrlResponse {
  url: string;
}

export interface MetaCatalog {
  id: string;
  name: string | null;
}

export interface MetaBusiness {
  id: string;
  name: string | null;
  catalogs: MetaCatalog[];
}

export interface MetaBusinessesResponse {
  businesses: MetaBusiness[];
}

export interface MetaCompleteConnectPayload {
  businessId: string;
  catalogId: string;
}
