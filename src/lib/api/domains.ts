import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Domain, DomainVerifyResult } from "@/types/domain";

export const getDomains = async () => {
  const { data } = await apiClient.get<BeResponse<Domain[]>>("/domains");
  return data;
};

export const createDomain = async (hostname: string) => {
  const { data } = await apiClient.post<BeResponse<Domain>>("/domains", { hostname });
  return data;
};

export const deleteDomain = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<null>>(`/domains/${id}`);
  return data;
};

export const setDefaultDomain = async (id: string) => {
  const { data } = await apiClient.put<BeResponse<Domain>>(`/domains/${id}/default`);
  return data;
};

export const verifyDomain = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<DomainVerifyResult>>(`/domains/${id}/verify`);
  return data;
};
