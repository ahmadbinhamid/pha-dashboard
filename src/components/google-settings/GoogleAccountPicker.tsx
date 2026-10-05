import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getGoogleAccounts, completeGoogleConnect } from "@/lib/api/google";
import {
  googleCompleteConnectFormSchema,
  GOOGLE_TARGET_COUNTRIES,
  type GoogleCompleteConnectFormValues,
} from "@/lib/validation/googleConnectForm";
import { googleConnectErrorMessage } from "@/config/googleConnect";
import type { ChannelInlineStepProps } from "@/types/channelConnect";

const DEFAULT_VALUES: GoogleCompleteConnectFormValues = {
  merchantId: "",
  targetCountry: "AU",
  feedLabel: "",
  contentLanguage: "en",
};

// Step 2 of Google's connect: pick the Merchant Center account after consent.
export function GoogleAccountPicker({ onComplete }: ChannelInlineStepProps) {
  const queryClient = useQueryClient();
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["google-accounts"],
    queryFn: getGoogleAccounts,
  });
  const accounts = accountsData?.data.accounts ?? [];
  const listSupported = accountsData?.data.listSupported ?? true;

  const { control, register, handleSubmit, watch, setValue, formState } = useForm<GoogleCompleteConnectFormValues>({
    resolver: zodResolver(googleCompleteConnectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Prefill feedLabel from the target country until the user edits it.
  const targetCountry = watch("targetCountry");
  useEffect(() => {
    if (!formState.dirtyFields.feedLabel) setValue("feedLabel", targetCountry);
  }, [targetCountry, formState.dirtyFields.feedLabel, setValue]);

  const completeMutation = useMutation({
    mutationFn: completeGoogleConnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      onComplete("Google Merchant Center account connected successfully.");
    },
  });

  const onSubmitAccount = (values: GoogleCompleteConnectFormValues) =>
    completeMutation.mutate({
      merchantId: values.merchantId,
      targetCountry: values.targetCountry,
      feedLabel: values.feedLabel || undefined,
      contentLanguage: values.contentLanguage || undefined,
    });

  return (
    <>
      {completeMutation.isError && (
        <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">
          {googleConnectErrorMessage((completeMutation.error as Error & { reason?: string })?.reason) ||
            (completeMutation.error as Error)?.message}
        </p>
      )}
      <p className="text-sm text-fg/65">
        You've granted Google access — pick which Merchant Center account this store should publish to.
      </p>
      {accountsLoading ? (
        <SkeletonText lines={3} />
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmitAccount)}>
          {listSupported && accounts.length > 0 ? (
            <FormField
              label="Merchant Center account"
              htmlFor="google-merchant-account"
              required
              error={formState.errors.merchantId?.message}
            >
              <Controller
                control={control}
                name="merchantId"
                render={({ field }) => (
                  <SingleSelect
                    id="google-merchant-account"
                    options={accounts.map((a) => ({
                      value: a.accountId,
                      label: a.accountName ? `${a.accountName} (${a.accountId})` : a.accountId,
                    }))}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Choose an account"
                  />
                )}
              />
            </FormField>
          ) : (
            <FormField
              label="Merchant Center ID"
              htmlFor="google-merchant-id"
              required
              hint={
                listSupported
                  ? "This Google account has no Merchant Center accounts we could list — enter the numeric ID directly."
                  : "We couldn't list your Merchant Center accounts automatically — enter the numeric account ID from Google Merchant Center directly."
              }
              error={formState.errors.merchantId?.message}
            >
              <Input id="google-merchant-id" placeholder="e.g. 123456789" {...register("merchantId")} />
            </FormField>
          )}

          <FormField label="Target country" required error={formState.errors.targetCountry?.message}>
            <Controller
              control={control}
              name="targetCountry"
              render={({ field }) => (
                <SingleSelect
                  options={[...GOOGLE_TARGET_COUNTRIES]}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>

          <FormField
            label="Feed label"
            htmlFor="google-feed-label"
            hint="Defaults to the target country — override only if you use a different feed label."
            error={formState.errors.feedLabel?.message}
          >
            <Input id="google-feed-label" {...register("feedLabel")} />
          </FormField>

          <FormField
            label="Content language"
            htmlFor="google-content-language"
            hint="ISO language code for your listings — defaults to en."
            error={formState.errors.contentLanguage?.message}
          >
            <Input id="google-content-language" {...register("contentLanguage")} />
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
