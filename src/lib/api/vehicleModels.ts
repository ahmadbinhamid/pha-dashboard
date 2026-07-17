import { apiClient } from "./client";
import type { BeResponse } from "./base";

export interface VehicleYears {
  year_from: number;
  year_to: number | null;
}

export async function getVehicleMakes() {
  const { data } = await apiClient.get<BeResponse<string[]>>("/vehicle-model/makes");
  return data;
}

export async function getVehicleModels(make: string) {
  const { data } = await apiClient.get<BeResponse<string[]>>("/vehicle-model/models", {
    params: { make },
  });
  return data;
}

export async function getVehicleModelCodes(make: string, model: string) {
  const { data } = await apiClient.get<BeResponse<string[]>>("/vehicle-model/model-codes", {
    params: { make, model },
  });
  return data;
}

export async function getVehicleYears(make: string, model: string, model_code: string) {
  const { data } = await apiClient.get<BeResponse<VehicleYears>>("/vehicle-model/years", {
    params: { make, model, model_code },
  });
  return data;
}
