import { useQuery } from "@tanstack/react-query";
import { MapPin, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { getLocations } from "@/lib/api/locations";

// Read-only for now: /location has full CRUD server-side, but the add/edit flow is its own piece of work — listing real hubs beats a Coming Soon panel over data that exists.
export function StoreWarehousesSection() {
  const { data, isLoading } = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const locations = data?.data ?? [];

  return (
    <SettingsSection
      title="Warehouses & Hubs"
      description="Physical sites your stock is counted against. Inventory rows and pickup orders are assigned to these."
      right={<Badge variant="muted">{locations.length} on file</Badge>}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
            <Warehouse className="h-8 w-8 text-fg/30" />
          </div>
          <div>
            <p className="font-medium text-fg">No warehouses yet</p>
            <p className="mt-1 text-sm text-fg/50">Stock is counted against your default location until you add one.</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {locations.map((location) => (
            <li
              key={location._id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Warehouse className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{location.name}</p>
                  {location.address ? (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-fg/55">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {location.address}
                    </p>
                  ) : null}
                </div>
              </div>
              <Badge variant={location.is_active ? "ok" : "muted"}>{location.is_active ? "Active" : "Inactive"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
