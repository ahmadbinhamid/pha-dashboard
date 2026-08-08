export type DomainStatus = "pending" | "active" | "suspended";

export interface Domain {
  _id: string;
  tenant_id: string;
  hostname: string;
  status: DomainStatus;
  is_default: boolean;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainVerifyResult {
  domain: Domain;
  verified: boolean;
  recordName: string;
  expectedValue: string;
}
