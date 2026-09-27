// Mirrors server/src/models/Location.js — the tenant's physical warehouses/pickup hubs that inventory rows are counted against.
export interface StoreLocation {
  _id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
