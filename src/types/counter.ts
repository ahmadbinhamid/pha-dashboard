import type { SaleType, FulfilmentType } from "./orders";

export type CounterCustomer = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type CounterCartLine = {
  productId: string;
  sku: string;
  title: string;
  qty: number;
  unitPriceInclGst: number;
};

export type { SaleType as CounterSaleType, FulfilmentType as CounterFulfilment };

export type CounterCartData = {
  customer: CounterCustomer;
  saleType: SaleType;
  fulfilment: FulfilmentType;
  lines: CounterCartLine[];
};

export type CounterCartActions = {
  setCustomer: (c: CounterCustomer) => void;
  setSaleType: (t: SaleType) => void;
  setFulfilment: (f: FulfilmentType) => void;
  addLine: (line: Omit<CounterCartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
};

export type CounterCartApi = CounterCartData & CounterCartActions;
