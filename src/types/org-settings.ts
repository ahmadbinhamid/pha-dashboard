export type OrgSettings = {
  storeName: string;
  displayName: string;
  location: string;
  currency: "AUD";
  logoDataUrl?: string;
  abn?: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
};
