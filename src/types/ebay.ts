export type EbayCondition =
  | "NEW"
  | "USED"
  | "NEW_OTHER"
  | "USED_EXCELLENT"
  | "USED_VERY_GOOD"
  | "USED_GOOD"
  | "USED_ACCEPTABLE";

export type CategorySuggestion = {
  categoryId: string;
  categoryName: string;
  breadcrumb: string;
};

export type CategorySuggestionsResponse =
  | { sandbox: true; suggestions: never[] }
  | { sandbox: false; suggestions: CategorySuggestion[] };

export type ConditionOption = {
  conditionId: string;
  conditionDescription: string;
};

export type ConditionPoliciesResponse = {
  conditionRequired: boolean;
  conditions: ConditionOption[];
};

export type BusinessPolicy = {
  id: string;
  name: string;
};

export type BusinessPoliciesResponse = {
  fulfillment: BusinessPolicy[];
  payment: BusinessPolicy[];
  return: BusinessPolicy[];
};

export type VehicleFitmentRow = {
  id: string;
  make: string;
  model: string;
  year: string;
  engine: string;
};

export type CategoryAspect = {
  name: string;
  required: boolean;
  mode: "FREE_TEXT" | "SELECTION_ONLY";
  cardinality: "SINGLE" | "MULTI";
  values: string[];
};

export type CategoryAspectsResponse = {
  aspects: CategoryAspect[];
};

export type StoreCategory = {
  categoryId: string;
  name: string;
  level: number;
};

export type StoreCategoriesResponse = {
  categories: StoreCategory[];
};

export type EbayUploaderFormPayload = {
  title: string;
  sku: string;
  oemNumber: string;
  brand: string;
  condition: EbayCondition;
  price: string;
  quantity: string;
  description: string;
  compatibilityText: string;
  fitmentRows: VehicleFitmentRow[];
  imageUrls: string[];
  ebayCategoryId: string;
};
