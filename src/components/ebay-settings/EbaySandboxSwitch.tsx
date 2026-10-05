import { Switch } from "@/components/ui/Switch";
import type { ChannelConnectOptionsProps } from "@/types/channelConnect";

// eBay's connect option: OAuth against the sandbox instead of production.
export function EbaySandboxSwitch({ value, onChange }: ChannelConnectOptionsProps) {
  return (
    <Switch
      checked={!!value.sandbox}
      onCheckedChange={(sandbox) => onChange({ ...value, sandbox })}
      label="Use eBay sandbox"
      description="For testing only — connects to eBay's sandbox environment instead of production."
    />
  );
}
