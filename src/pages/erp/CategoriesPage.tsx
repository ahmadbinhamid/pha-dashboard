import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/context";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/api/categories";
import type { CategoryPayload } from "@/lib/api/categories";
import { ThumbnailPicker } from "@/components/categories/thumbnail-picker";
import type { Category, CategoryFormState } from "@/types/product";
import { Plus, Layers, Pencil, Trash2, AlertTriangle, Search } from "lucide-react";

const EMPTY_FORM: CategoryFormState = { name: "", description: "", thumbnail: null };

function categoryToForm(c: Category): CategoryFormState {
  return {
    name: c.name,
    description: c.description ?? "",
    thumbnail: c.thumbnail ?? null,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const search = searchParams.get("search") ?? "";

  const [inputValue, setInputValue] = useState(search);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const setPage = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const current = prev.get("search") ?? "";
        if (inputValue === current) return prev; // no change — don't reset page
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["categories", { page, search }],
    queryFn: () => getCategories({ page, search }),
  });

  const categories: Category[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const openCreate = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm(categoryToForm(category));
    setErrors({});
    setFormOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast({ title: "Category created", tone: "success" });
      invalidate();
      setFormOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Create failed", description: err.message, tone: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryPayload }) =>
      updateCategory(id, payload),
    onSuccess: () => {
      toast({ title: "Category updated", tone: "success" });
      invalidate();
      setFormOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, tone: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast({ title: "Category deleted", tone: "success" });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, tone: "danger" });
      setDeleteTarget(null);
    },
  });

  function buildPayload(): CategoryPayload {
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      thumbnail: form.thumbnail?._id ?? null,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Category name is required" });
      return;
    }
    setErrors({});
    const payload = buildPayload();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-fg/55">
            {total > 0
              ? `${total} categor${total !== 1 ? "ies" : "y"} in your catalogue`
              : "Organise your products into categories"}
          </p>
        </div>
        <Button variant="primary" size="md" className="gap-2 self-start sm:self-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40 pointer-events-none" />
            <Input
              placeholder="Search categories…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>
          {isFetching && !isLoading && (
            <span className="text-xs text-fg/40">Updating…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : categories.length === 0 ? (
            <EmptyState search={search} onNew={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  <th className="w-px px-5 py-3" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category._id} className="transition hover:bg-bg-2/50">
                    <td className="px-5 py-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
                        {category.thumbnail?.url ? (
                          <img
                            src={category.thumbnail.url}
                            alt={category.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Layers className="h-5 w-5 text-fg/25" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-fg">{category.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg/55">{category.slug}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-fg/55">
                      {category.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(category)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>

      {/* Create / edit modal */}
      <Modal open={formOpen} onOpenChange={setFormOpen}>
        <ModalContent>
          <form onSubmit={handleSubmit}>
            <ModalHeader>
              <ModalTitle>{editingCategory ? "Edit category" : "New category"}</ModalTitle>
              <ModalDescription>
                {editingCategory
                  ? "Update this category's details."
                  : "Create a new category to organise your products."}
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4">
              <FormField label="Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Engine Parts"
                  autoFocus
                />
              </FormField>

              <FormField label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to customers"
                  size="sm"
                />
              </FormField>

              <FormField label="Thumbnail">
                <ThumbnailPicker
                  value={form.thumbnail}
                  onChange={(thumbnail) => setForm((f) => ({ ...f, thumbnail }))}
                />
              </FormField>
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={isSaving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSaving}>
                {isSaving ? "Saving…" : editingCategory ? "Save changes" : "Create category"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        {deleteTarget && (
          <ModalContent className="max-w-sm">
            <ModalHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
              <ModalTitle>Delete category?</ModalTitle>
              <ModalDescription>
                <span className="font-medium text-fg">{deleteTarget.name}</span>{" "}
                will be permanently deleted. This action cannot be undone.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                className="flex-1 gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget._id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </ModalFooter>
          </ModalContent>
        )}
      </Modal>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-4 w-40 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-4 w-24 animate-pulse rounded-xs bg-bg-2" />
          <div className="ml-auto h-4 w-10 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Layers className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">
          {search ? "No categories found" : "No categories yet"}
        </p>
        <p className="mt-1 text-sm text-fg/50">
          {search
            ? `No results for "${search}" — try a different term`
            : "Create your first category to get started"}
        </p>
      </div>
      {!search && (
        <Button variant="primary" size="sm" className="mt-1 gap-1.5" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          New Category
        </Button>
      )}
    </div>
  );
}
