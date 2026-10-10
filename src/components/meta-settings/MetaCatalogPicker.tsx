import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { completeMetaConnect, getMetaBusinesses } from "@/lib/api/meta";
import { metaCompleteConnectFormSchema, type MetaCompleteConnectFormValues } from "@/lib/validation/metaConnectForm";
import { metaConnectErrorMessage } from "@/config/metaConnect";
import type { ChannelInlineStepProps } from "@/types/channelConnect";
import { InlineNotice } from "@/components/ui/InlineNotice";

const DEFAULT_VALUES: MetaCompleteConnectFormValues = { businessId: "", catalogId: "" };

const optionLabel = (item: { id: string; name: string | null }) => (item.name ? `${item.name} (${item.id})` : item.id);

// Step 2 of Meta's connect: pick the business and catalog after consent.
export function MetaCatalogPicker({ onComplete }: ChannelInlineStepProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["meta-businesses"], queryFn: getMetaBusinesses });
  const businesses = useMemo(() => data?.data.businesses ?? [], [data]);

  const { control, handleSubmit, watch, setValue, formState } = useForm<MetaCompleteConnectFormValues>({
    resolver: zodResolver(metaCompleteConnectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // A single business is preselected; the catalog resets when it changes.
  const businessId = watch("businessId");
  useEffect(() => {
    if (!businessId && businesses.length === 1) setValue("businessId", businesses[0].id);
  }, [businessId, businesses, setValue]);
  useEffect(() => setValue("catalogId", ""), [businessId, setValue]);
  const catalogs = businesses.find((b) => b.id === businessId)?.catalogs ?? [];

  const completeMutation = useMutation({
    mutationFn: completeMetaConnect,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      onComplete("Meta catalog connected. Your first sync has started.");
    },
  });

  if (isLoading) return <SkeletonText lines={3} />;
  if (isError) {
    return (
      <InlineNotice variant="danger">
        {metaConnectErrorMessage((error as Error & { reason?: string })?.reason) || (error as Error)?.message}
      </InlineNotice>
    );
  }

  return (
    <>
      {completeMutation.isError && (
        <InlineNotice variant="danger">
          {metaConnectErrorMessage((completeMutation.error as Error & { reason?: string })?.reason)}
        </InlineNotice>
      )}
      <p className="text-sm text-fg/65">
        You've granted Meta access. Pick the business and catalog this store should publish to.
      </p>
      {businesses.length === 0 ? (
        <InlineNotice variant="warn">
          This sign-in didn't grant access to any business. Reconnect and share a business and catalog with this app.
        </InlineNotice>
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => completeMutation.mutate(values))}>
          <FormField label="Business" htmlFor="meta-business" required error={formState.errors.businessId?.message}>
            <Controller
              control={control}
              name="businessId"
              render={({ field }) => (
                <SingleSelect
                  id="meta-business"
                  options={businesses.map((b) => ({ value: b.id, label: optionLabel(b) }))}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Choose a business"
                />
              )}
            />
          </FormField>
          <FormField
            label="Catalog"
            htmlFor="meta-catalog"
            required
            hint={businessId && catalogs.length === 0 ? "No catalogs in this business. Create one in Commerce Manager, then reconnect." : undefined}
            error={formState.errors.catalogId?.message}
          >
            <Controller
              control={control}
              name="catalogId"
              render={({ field }) => (
                <SingleSelect
                  id="meta-catalog"
                  options={catalogs.map((c) => ({ value: c.id, label: optionLabel(c) }))}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Choose a catalog"
                  disabled={!businessId || catalogs.length === 0}
                />
              )}
            />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={completeMutation.isPending}>
              {completeMutation.isPending ? "Connecting…" : "Finish connecting"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
