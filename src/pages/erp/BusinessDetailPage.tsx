import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserMinus, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { Can } from "@/components/auth/Can";
import { CustomerDetailSkeleton } from "@/components/customers/CustomerDetailSkeleton";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { BusinessFormModal } from "@/components/businesses/BusinessFormModal";
import { AddExistingRepresentativeModal } from "@/components/businesses/AddExistingRepresentativeModal";
import { AddRepresentativeMenu } from "@/components/businesses/AddRepresentativeMenu";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { BUSINESSES_QUERY_KEY, deleteBusiness, getBusiness } from "@/lib/api/businesses";
import { getCustomer, updateCustomer } from "@/lib/api/customers";
import type { BusinessRepresentative } from "@/types/business";

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addRepOpen, setAddRepOpen] = useState(false);
  const [newRepName, setNewRepName] = useState("");
  const [linkRepOpen, setLinkRepOpen] = useState(false);
  const [editingRepId, setEditingRepId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<BusinessRepresentative | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: [...BUSINESSES_QUERY_KEY, "detail", id],
    queryFn: () => getBusiness(id!),
    enabled: !!id,
  });
  const business = data?.data;

  // The rep form edits a full customer, addresses included.
  const { data: editingRes } = useQuery({
    queryKey: ["customer", editingRepId],
    queryFn: () => getCustomer(editingRepId!),
    enabled: !!editingRepId,
  });
  const editingCustomer = editingRepId && editingRes?.data?._id === editingRepId ? editingRes.data : null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["customer"] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteBusiness(id!),
    onSuccess: () => {
      toast({ title: "Business deleted", tone: "success" });
      refresh();
      navigate("/businesses");
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, tone: "danger" });
      setDeleteOpen(false);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (repId: string) => updateCustomer(repId, { business_name: null }),
    onSuccess: () => {
      toast({ title: "Representative removed from business", tone: "success" });
      refresh();
      setUnlinkTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Remove failed", description: err.message, tone: "danger" });
      setUnlinkTarget(null);
    },
  });

  if (isLoading) return <CustomerDetailSkeleton />;
  if (isError || !business) {
    return (
      <EmptyState icon={Users} title="Business not found" description="It may have been deleted." className="py-20" />
    );
  }

  const reps = business.representatives;

  return (
    <div className="space-y-5 pb-24">
      <BreadcrumbNav items={[{ label: "Businesses", href: "/businesses" }, { label: business.name }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{business.name}</h1>
          <p className="mt-1 text-sm text-fg/55">
            {reps.length} representative{reps.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <Can permission={PERMISSIONS.customers.update}>
            <Button variant="secondary" size="md" className="gap-2" onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4" />
              Rename
            </Button>
          </Can>
          <Can permission={PERMISSIONS.customers.delete}>
            <Button variant="danger" size="md" className="gap-2" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </Can>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Representatives"
          description="Each is a separate customer you can select on an invoice."
          right={
            <AddRepresentativeMenu
              onAddExisting={() => setLinkRepOpen(true)}
              onCreateNew={() => {
                setNewRepName("");
                setAddRepOpen(true);
              }}
            />
          }
        />
        {reps.length === 0 ? (
          <EmptyState icon={Users} title="No representatives yet" description="Add one to start invoicing this business." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow>
                  <StickyTableHead size={48}>Name</StickyTableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep) => (
                  <TableRow key={rep._id} className="group cursor-pointer" onClick={() => navigate(`/customers/${rep._id}`)}>
                    <StickyTableCell size={48} className="truncate font-medium text-fg">
                      {rep.name}
                    </StickyTableCell>
                    <TableCell className="text-fg/60">{rep.email || "—"}</TableCell>
                    <TableCell className="text-fg/60">{rep.phone || "—"}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Can permission={PERMISSIONS.customers.update}>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${rep.name}`}
                            onClick={() => setEditingRepId(rep._id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${rep.name} from ${business.name}`}
                            onClick={() => setUnlinkTarget(rep)}
                          >
                            <UserMinus className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <BusinessFormModal open={renameOpen} onOpenChange={setRenameOpen} business={business} />
      <CustomerFormModal
        open={addRepOpen}
        onOpenChange={setAddRepOpen}
        customer={null}
        initialName={newRepName}
        initialBusinessName={business.name}
      />
      <AddExistingRepresentativeModal
        open={linkRepOpen}
        onOpenChange={setLinkRepOpen}
        business={business}
        onCreateNew={(text) => {
          setNewRepName(text);
          setAddRepOpen(true);
        }}
      />
      <CustomerFormModal
        open={!!editingCustomer}
        onOpenChange={(open) => {
          if (!open) setEditingRepId(null);
        }}
        customer={editingCustomer}
      />
      <ConfirmModal
        open={!!unlinkTarget}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null);
        }}
        title="Remove from business?"
        description={`${unlinkTarget?.name ?? ""} stays a customer, just no longer under ${business.name}. Past invoices are unchanged.`}
        confirmLabel="Remove"
        tone="danger"
        confirming={unlinkMutation.isPending}
        onConfirm={() => unlinkTarget && unlinkMutation.mutate(unlinkTarget._id)}
      />
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete business?"
        description={
          reps.length > 0
            ? "Remove or move its representatives first. A business with representatives can't be deleted."
            : `${business.name} will be deleted. Past invoices keep its name.`
        }
        confirmLabel="Delete"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
