// Days a business account has to pay an invoice.
export type PaymentTermsDays = 7 | 14 | 30;

// A trading account that one or more customers represent.
export interface Business {
  _id: string;
  name: string;
}

export interface BusinessListItem extends Business {
  payment_terms_days: PaymentTermsDays | null;
  representatives_count: number;
  created_at: string;
}

// A customer linked to the business, billable on its own invoices.
export interface BusinessRepresentative {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface BusinessDetail extends Business {
  payment_terms_days: PaymentTermsDays | null;
  representatives: BusinessRepresentative[];
  created_at: string;
}

// Request shapes for the /business API.

export interface BusinessListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface RepresentativePayload {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface UpdateBusinessPayload {
  name: string;
  payment_terms_days: PaymentTermsDays | null;
}

export interface CreateBusinessPayload extends UpdateBusinessPayload {
  representatives: RepresentativePayload[];
}
