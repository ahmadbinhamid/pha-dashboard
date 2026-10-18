// A trading account that one or more customers represent.
export interface Business {
  _id: string;
  name: string;
}

export interface BusinessListItem extends Business {
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
  representatives: BusinessRepresentative[];
  created_at: string;
}
