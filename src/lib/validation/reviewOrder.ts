import { z } from "zod";
import { ORDER_PAYMENT_CHOICE_LABEL } from "@/config/paymentMethods";
import type { OrderPaymentChoice } from "@/types/payment";

const PAYMENT_CHOICE_VALUES = Object.keys(ORDER_PAYMENT_CHOICE_LABEL) as [OrderPaymentChoice, ...OrderPaymentChoice[]];

export const paymentChoiceSchema = z.enum(PAYMENT_CHOICE_VALUES, {
  error: "Select how this order will be settled",
});
