import { useQuery } from "@tanstack/react-query";
import { getBusinessPolicies, getEbaySettings } from "@/lib/api/ebay";
import type { ChannelFieldOption } from "@/types/channel";
import type { MappedCategory } from "@/types/categoryMapping";

export interface ChannelFieldSources {
  // Dynamic options keyed by optionsSource.
  options: Record<string, ChannelFieldOption[]>;
  // Server-side fallback per field key.
  fallbacks: Record<string, string | null | undefined>;
  loading: boolean;
}

// Options and fallbacks a schema can't carry (eBay policies, mapped category).
export function useChannelFieldSources(
  platform: string,
  categoryField: string | undefined,
  mappedCategory: MappedCategory | null | undefined,
): ChannelFieldSources {
  const isEbay = platform === "ebay";
  const policies = useQuery({
    queryKey: ["ebay-business-policies"],
    queryFn: getBusinessPolicies,
    staleTime: 10 * 60 * 1000,
    enabled: isEbay,
  });
  const ebaySettings = useQuery({ queryKey: ["ebay-settings"], queryFn: getEbaySettings, enabled: isEbay });

  const toOptions = (list: { id: string; name: string }[] | undefined) => (list ?? []).map((p) => ({ value: p.id, label: p.name }));
  const settings = ebaySettings.data?.data;

  return {
    options: isEbay
      ? {
          "ebay.businessPolicies.fulfillment": toOptions(policies.data?.data?.fulfillment),
          "ebay.businessPolicies.payment": toOptions(policies.data?.data?.payment),
          "ebay.businessPolicies.return": toOptions(policies.data?.data?.return),
        }
      : {},
    fallbacks: {
      ...(categoryField ? { [categoryField]: mappedCategory?.id } : {}),
      ...(isEbay
        ? {
            fulfillment_policy_id: settings?.fulfillment_policy_id,
            payment_policy_id: settings?.payment_policy_id,
            return_policy_id: settings?.return_policy_id,
          }
        : {}),
    },
    loading: isEbay && (policies.isLoading || ebaySettings.isLoading),
  };
}
