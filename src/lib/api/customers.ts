import type { ApiResponse, PaginatedResponse } from "./base";
import type { Customer } from "@/types";

export type { Customer };

export type CustomersListParams = {
  page?: number;
  search?: string;
};

export type CreateCustomerInput = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
};

// Stubs — implement once BE is ready
export async function getCustomers(
  _params: CustomersListParams = {},
): Promise<ApiResponse<PaginatedResponse<Customer>>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function createCustomer(
  _input: CreateCustomerInput,
): Promise<ApiResponse<{ customer: Customer }>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function deleteCustomer(_id: string): Promise<ApiResponse> {
  throw new Error("Not implemented — BE not finalized");
}
