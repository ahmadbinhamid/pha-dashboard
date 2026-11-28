import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type {
  CampaignAudience,
  CampaignDetail,
  CampaignKind,
  CampaignListItem,
  CampaignPayload,
  CampaignPreview,
  CampaignStatus,
  CampaignTemplate,
  Contact,
  ContactFilters,
  ContactImportResult,
  ContactList,
  ContactPayload,
  ContactSelection,
  ContactStats,
  EmailDesign,
} from "@/types/campaign";


export const CAMPAIGNS_QUERY_KEY = ["campaigns"] as const;
export const campaignQueryKey = (id: string) => [...CAMPAIGNS_QUERY_KEY, id] as const;
export const CONTACTS_QUERY_KEY = ["campaign-contacts"] as const;
export const TEMPLATES_QUERY_KEY = ["campaign-templates"] as const;

// Contacts

export const getContacts = async (params: ContactFilters & { page: number; limit: number }) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Contact>>>("/campaigns/contacts", { params });
  return data;
};

export const getContactStats = async () => {
  const { data } = await apiClient.get<BeResponse<ContactStats>>("/campaigns/contacts/stats");
  return data;
};

export const getContactLists = async () => {
  const { data } = await apiClient.get<BeResponse<ContactList[]>>("/campaigns/contacts/lists");
  return data;
};

export const selectContactIds = async (filters: ContactFilters) => {
  const { data } = await apiClient.get<BeResponse<ContactSelection>>("/campaigns/contacts/select-ids", { params: filters });
  return data;
};

export const renameContactList = async (from: string, to: string) => {
  const { data } = await apiClient.post<BeResponse<{ name: string }>>("/campaigns/contacts/lists/rename", { from, to });
  return data;
};

export const deleteContactList = async (name: string) => {
  const { data } = await apiClient.post<BeResponse<{ name: string }>>("/campaigns/contacts/lists/delete", { name });
  return data;
};

export const bulkUpdateContactLists = async (payload: { ids: string[]; add?: string; remove?: string }) => {
  const { data } = await apiClient.post<BeResponse<{ updated: number }>>("/campaigns/contacts/bulk-lists", payload);
  return data;
};

export const createContact = async (payload: ContactPayload) => {
  const { data } = await apiClient.post<BeResponse<Contact>>("/campaigns/contacts", payload);
  return data;
};

export const updateContact = async (id: string, payload: ContactPayload) => {
  const { data } = await apiClient.patch<BeResponse<Contact>>(`/campaigns/contacts/${id}`, payload);
  return data;
};

export const deleteContact = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<{ _id: string }>>(`/campaigns/contacts/${id}`);
  return data;
};

export const importContacts = async (file: File, lists: string[]) => {
  const form = new FormData();
  form.append("file", file);
  form.append("lists", lists.join(","));
  // Large sheets take a while to upsert; the default 15s is too tight.
  const { data } = await apiClient.post<BeResponse<ContactImportResult>>("/campaigns/contacts/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
  });
  return data;
};

export const exportContacts = async (filters: ContactFilters) => {
  const response = await apiClient.get("/campaigns/contacts/export", {
    params: filters,
    responseType: "blob",
    timeout: 120_000,
  });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? "contacts.xlsx";
  return { blob: response.data as Blob, filename };
};

// Campaigns

export const getCampaigns = async (params: {
  page: number;
  limit: number;
  search?: string;
  status?: CampaignStatus;
  kind?: CampaignKind;
}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<CampaignListItem>>>("/campaigns", { params });
  return data;
};

export const getCampaign = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<CampaignDetail>>(`/campaigns/${id}`);
  return data;
};

export const createCampaign = async (payload: CampaignPayload) => {
  const { data } = await apiClient.post<BeResponse<CampaignDetail>>("/campaigns", payload);
  return data;
};

export const updateCampaign = async (id: string, payload: CampaignPayload) => {
  const { data } = await apiClient.patch<BeResponse<CampaignDetail>>(`/campaigns/${id}`, payload);
  return data;
};

export const deleteCampaign = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<{ _id: string }>>(`/campaigns/${id}`);
  return data;
};

export const duplicateCampaign = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<CampaignDetail>>(`/campaigns/${id}/duplicate`);
  return data;
};

export const sendCampaign = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<CampaignDetail>>(`/campaigns/${id}/send`);
  return data;
};

export const scheduleCampaign = async (id: string, scheduledAt?: string) => {
  const body = scheduledAt ? { scheduled_at: scheduledAt } : {};
  const { data } = await apiClient.post<BeResponse<CampaignDetail>>(`/campaigns/${id}/schedule`, body);
  return data;
};

export const pauseCampaign = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<CampaignDetail>>(`/campaigns/${id}/pause`);
  return data;
};

export const sendTestCampaign = async (id: string, email: string) => {
  const { data } = await apiClient.post<BeResponse<{ to: string }>>(`/campaigns/${id}/test`, { email });
  return data;
};

export const getAudienceCount = async (audience: CampaignAudience) => {
  const { data } = await apiClient.post<BeResponse<{ count: number; limit: number }>>("/campaigns/audience-count", audience);
  return data;
};

export const previewCampaign = async (payload: { design: EmailDesign; subject: string; preheader: string }) => {
  const { data } = await apiClient.post<BeResponse<CampaignPreview>>("/campaigns/preview", payload);
  return data;
};

// Templates

export const getTemplates = async () => {
  const { data } = await apiClient.get<BeResponse<CampaignTemplate[]>>("/campaigns/templates");
  return data;
};

export const createTemplate = async (payload: { name: string; design: EmailDesign }) => {
  const { data } = await apiClient.post<BeResponse<CampaignTemplate>>("/campaigns/templates", payload);
  return data;
};

export const deleteTemplate = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<{ _id: string }>>(`/campaigns/templates/${id}`);
  return data;
};
