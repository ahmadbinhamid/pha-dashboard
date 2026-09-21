import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { StoreLocation } from "@/types/locations";

// /location is unpaginated — listLocations returns every location for the
// tenant, which is a handful of warehouses, not a growing collection.
export const getLocations = async () => {
  const { data } = await apiClient.get<BeResponse<StoreLocation[]>>("/location");
  return data;
};
