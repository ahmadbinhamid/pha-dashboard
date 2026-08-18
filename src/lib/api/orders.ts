import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type {
  Order,
  OrderAddress,
  OrderDeliveryMethod,
  OrderDetail,
  OrderFulfillmentStatus,
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

// The same pdfkit-rendered tax invoice attached to the order emails — no
// BeResponse envelope here, the server sends the raw PDF bytes. Filename
// comes from the server's Content-Disposition header (order number), with a
// generic fallback only if that header is somehow missing.
export const downloadInvoicePdf = async (id: string) => {
  const response = await apiClient.get(`/order/${id}/invoice-pdf`, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] as string | undefined;
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `invoice-${id}.pdf`;
  return { blob: response.data as Blob, filename };
};

// ── Manual/in-person orders (POS) ───────────────────────────────────────────

export interface CreateManualOrderItemPayload {
  product: string;
  variant?: string | null;
  quantity: number;
  discount_amount?: number; // dollars
  note?: string | null;
}

export interface CreateManualOrderPayload {
  customer_id: string;
  items: CreateManualOrderItemPayload[];
  delivery_method: OrderDeliveryMethod;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
  note?: string | null;
  // Always required — "payment_link" means nothing is collected now and a
  // Stripe Checkout link is generated separately instead.
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

// Generates the same payment link as generatePaymentLink above, and also
// emails it straight to the customer — used by the "Send Payment Link"
// action on the order creation confirmation screen.
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

// Follow-up cash/online-transfer payment against an order's outstanding
// balance — e.g. settling the rest of a manual sale's deposit later.
export const recordOrderPayment = async (orderId: string, payload: RecordOrderPaymentPayload) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/payments`, payload);
  return data;
};

export const addOrderNote = async (orderId: string, text: string) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/notes`, { text });
  return data;
};

// Corrects a single line item's price on an eBay/manual order — storefront
// orders reject this server-side (their pricing is the storefront's own
// listed price). Recomputes subtotal/tax_amount/total on the backend.
export const updateOrderItemPrice = async (orderId: string, itemIndex: number, unit_price: number) => {
  const { data } = await apiClient.patch<BeResponse<Order>>(`/order/${orderId}/items/${itemIndex}/price`, {
    unit_price,
  });
  return data;
};

// Corrects the order's freight charge after the fact (eBay/manual orders
// only). Recomputes tax_amount/total on the backend.
export const updateOrderShippingCost = async (orderId: string, shipping_cost: number) => {
  const { data } = await apiClient.patch<BeResponse<Order>>(`/order/${orderId}/shipping-cost`, { shipping_cost });
  return data;
};

// Corrects a single line item's discount on an eBay/manual order — see
// order.service.js#updateOrderItemDiscount. Recomputes subtotal/tax_amount/
// total on the backend.
export const updateOrderItemDiscount = async (orderId: string, itemIndex: number, discount_amount: number) => {
  const { data } = await apiClient.patch<BeResponse<Order>>(`/order/${orderId}/items/${itemIndex}/discount`, {
    discount_amount,
  });
  return data;
};

export interface UpdateOrderCustomerDetailsPayload {
  customer?: { name?: string; email?: string | null; phone?: string | null };
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
}

// Corrects the order's own customer/address snapshot — never the linked
// Customer record (see order.service.js#updateOrderCustomerDetails).
export const updateOrderCustomerDetails = async (orderId: string, payload: UpdateOrderCustomerDetailsPayload) => {
  const { data } = await apiClient.put<BeResponse<Order>>(`/order/${orderId}/customer-details`, payload);
  return data;
};
