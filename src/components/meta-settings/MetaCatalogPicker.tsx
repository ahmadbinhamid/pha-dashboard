import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { MetaReconnectButton } from "@/components/meta-settings/MetaReconnectButton";
import { completeMetaConnect, getMetaCatalogs } from "@/lib/api/meta";
import { metaCompleteConnectFormSchema, type MetaCompleteConnectFormValues } from "@/lib/validation/metaConnectForm";
import { metaApiErrorMessage } from "@/config/metaConnect";
import type { ChannelInlineStepProps } from "@/types/channelConnect";

const DEFAULT_VALUES: MetaCompleteConnectFormValues = { catalogId: "" };

const optionLabel = (item: { id: string; name: string | null }) => (item.name ? `${item.name} (${item.id})` : item.id);

// Step 2 of Meta's connect: pick one of several catalogs granted at sign-in.
export function MetaCatalogPicker({ onComplete }: ChannelInlineStepProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["meta-catalogs"], queryFn: getMetaCatalogs, retry: false });
  const catalogs = data?.data.catalogs ?? [];

  const { control, handleSubmit, formState } = useForm<MetaCompleteConnectFormValues>({
    resolver: zodResolver(metaCompleteConnectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const completeMutation = useMutation({
    mutationFn: completeMetaConnect,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      onComplete("Meta catalog connected. Your first sync has started.");
    },
  });

  if (isLoading) return <SkeletonText lines={2} />;
  // Includes "no catalog granted"; Graph errors keep Meta's code in the text.
  if (isError) {
    return (
      <>
        <InlineNotice variant="danger">{metaApiErrorMessage(error)}</InlineNotice>
        <MetaReconnectButton />
      </>
    );
  }

  return (
    <>
      {completeMutation.isError && <InlineNotice variant="danger">{metaApiErrorMessage(completeMutation.error)}</InlineNotice>}
      <p className="text-sm text-fg/65">You granted Meta access to more than one catalog. Pick the one this store should publish to.</p>
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => completeMutation.mutate(values))}>
        <FormField label="Catalog" htmlFor="meta-catalog" required error={formState.errors.catalogId?.message}>
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
    </>
  );
}
