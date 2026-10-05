import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type {
  CreateManualOrderItemPayload,
  Order,
  OrderAddress,
  OrderDeliveryMethod,
  OrderDetail,
  OrderLineInput,
  OrderFulfillmentStatus,
  OrderStats,
} from "@/types/orders";
import type { OrderPaymentChoice, PaymentMethod } from "@/types/payment";

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  channel?: string;
  delivery_method?: string;
  fulfillment_status?: string;
  payment_status?: string;
}

export const getOrders = async (params: OrderListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Order>>>("/order", { params });
  return data;
};

export const getOrderStats = async () => {
  const { data } = await apiClient.get<BeResponse<OrderStats>>("/order/stats");
  return data;
};

export const getOrderDetail = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<OrderDetail>>(`/order/${id}/detail`);
  return data;
};

export interface SendOrderEmailPayload {
  tracking_number?: string;
  carrier_name?: string;
}

export const sendOrderEmail = async (id: string, payload: SendOrderEmailPayload = {}) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${id}/send-email`, payload);
  return data;
};

// Raw pdfkit invoice bytes (no envelope); filename from Content-Disposition.
export const downloadInvoicePdf = async (id: string) => {
  const response = await apiClient.get(`/order/${id}/invoice-pdf`, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `invoice-${id}.pdf`;
  return { blob: response.data as Blob, filename };
};

// Manual/in-person orders (POS)

export interface CreateManualOrderPayload {
  customer_id: string;
  items: CreateManualOrderItemPayload[];
  delivery_method: OrderDeliveryMethod;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
  note?: string | null;
  // "payment_link" collects nothing now; the Stripe link is made separately.
  payment_method: OrderPaymentChoice;
  amount_paid?: number; // dollars — omit/0 leaves the invoice fully outstanding
  shipping_cost?: number; // dollars — overrides the computed per-item shipping total
}

export const createManualOrder = async (payload: CreateManualOrderPayload) => {
  const { data } = await apiClient.post<BeResponse<Order>>("/order/manual", payload);
  return data;
};

export const generatePaymentLink = async (orderId: string) => {
  const { data } = await apiClient.post<BeResponse<{ url: string }>>(`/order/${orderId}/payment-link`);
  return data;
};

// Same link as generatePaymentLink, emailed to the customer.
export const sendPaymentLinkEmail = async (orderId: string) => {
  const { data } = await apiClient.post<BeResponse<{ url: string }>>(`/order/${orderId}/payment-link/send`);
  return data;
};

export const updateOrderStatus = async (orderId: string, status: OrderFulfillmentStatus) => {
  const { data } = await apiClient.patch<BeResponse<Order>>(`/order/${orderId}/status`, { status });
  return data;
};

export interface RecordOrderPaymentPayload {
  payment_method: PaymentMethod;
  amount: number; // dollars
}

// Follow-up cash/transfer payment against the balance, e.g. after a deposit.
export const recordOrderPayment = async (orderId: string, payload: RecordOrderPaymentPayload) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/payments`, payload);
  return data;
};

export const addOrderNote = async (orderId: string, text: string) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/notes`, { text });
  return data;
};

// Unpaid in-store orders only; the server recomputes totals, checks version.
export const updateOrderItemPrice = async (orderId: string, itemIndex: number, unit_price: number, version: number) => {
  const { data } = await apiClient.patch<BeResponse<OrderDetail>>(`/order/${orderId}/items/${itemIndex}/price`, {
    unit_price,
    version,
  });
  return data;
};

// Freight fix on an unpaid in-store order; the backend recomputes totals.
export const updateOrderShippingCost = async (orderId: string, shipping_cost: number, version: number) => {
  const { data } = await apiClient.patch<BeResponse<OrderDetail>>(`/order/${orderId}/shipping-cost`, {
    shipping_cost,
    version,
  });
  return data;
};

export const addOrderItem = async (orderId: string, item: OrderLineInput, version: number) => {
  const { data } = await apiClient.post<BeResponse<OrderDetail>>(`/order/${orderId}/items`, { item, version });
  return data;
};

export const updateOrderItemQuantity = async (orderId: string, itemId: string, quantity: number, version: number) => {
  const { data } = await apiClient.patch<BeResponse<OrderDetail>>(`/order/${orderId}/items/${itemId}/quantity`, {
    quantity,
    version,
  });
  return data;
};

export const removeOrderItem = async (orderId: string, itemId: string, version: number) => {
  const { data } = await apiClient.delete<BeResponse<OrderDetail>>(`/order/${orderId}/items/${itemId}`, {
    params: { version },
  });
  return data;
};

// Customer/staff reference (e.g. a PO number); blank clears it.
export const updateOrderReferenceNumber = async (orderId: string, reference_number: string) => {
  const { data } = await apiClient.patch<BeResponse<Order>>(`/order/${orderId}/reference-number`, {
    reference_number,
  });
  return data;
};

// Line discount fix on an unpaid in-store order; the backend recomputes totals.
export const updateOrderItemDiscount = async (orderId: string, itemIndex: number, discount_amount: number, version: number) => {
  const { data } = await apiClient.patch<BeResponse<OrderDetail>>(`/order/${orderId}/items/${itemIndex}/discount`, {
    discount_amount,
    version,
  });
  return data;
};

export interface UpdateOrderCustomerDetailsPayload {
  customer?: { name?: string; email?: string | null; phone?: string | null };
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
}

// Edits the order's own snapshot, never the linked Customer record.
export const updateOrderCustomerDetails = async (orderId: string, payload: UpdateOrderCustomerDetailsPayload) => {
  const { data } = await apiClient.put<BeResponse<Order>>(`/order/${orderId}/customer-details`, payload);
  return data;
};
