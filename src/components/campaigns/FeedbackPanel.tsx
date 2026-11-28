import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MessageSquareHeart, Search, Smile, Star, ThumbsDown, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { RatingStars } from "@/components/campaigns/RatingStars";
import { FEEDBACK_RATING_FILTER_OPTIONS, LOW_RATING_MAX } from "@/config/followups";
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "@/config/pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { pluralize } from "@/utils/format";
import { FEEDBACK_QUERY_KEY, getFeedback, getFeedbackStats } from "@/lib/api/followups";

const ALL = "all";

function ratingParams(filter: string) {
  if (filter === ALL) return {};
  if (filter === "low") return { max_rating: LOW_RATING_MAX };
  return { rating: Number(filter) };
}

export function FeedbackPanel() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const [rating, setRating] = useState(ALL);

  const { data: statsRes, isLoading: statsLoading } = useQuery({ queryKey: [...FEEDBACK_QUERY_KEY, "stats"], queryFn: getFeedbackStats });
  const params = { page, limit, search: search || undefined, ...ratingParams(rating) };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...FEEDBACK_QUERY_KEY, "list", params],
    queryFn: () => getFeedback(params),
    placeholderData: keepPreviousData,
  });
  const stats = statsRes?.data;
  const items = data?.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          size="sm"
          label="Average rating"
          value={stats?.average != null ? `${stats.average} / 5` : "—"}
          subLabel={stats ? pluralize(stats.count, "rating") : undefined}
          icon={<Star className="h-4 w-4" />}
          loading={statsLoading}
        />
        <MetricCard
          size="sm"
          label="Happy (4–5★)"
          value={stats ? stats.distribution[4] + stats.distribution[5] : "—"}
          icon={<Smile className="h-4 w-4" />}
          tone="ok"
          loading={statsLoading}
        />
        <MetricCard
          size="sm"
          label="Unhappy (1–2★)"
          value={stats ? stats.low : "—"}
          subLabel={stats?.low ? "Worth a call" : undefined}
          icon={<ThumbsDown className="h-4 w-4" />}
          tone={stats?.low ? "warn" : "ok"}
          loading={statsLoading}
          onClick={() => {
            setRating("low");
            setPage(1);
          }}
        />
        <MetricCard
          size="sm"
          label="Response rate"
          value={stats?.response_rate != null ? `${stats.response_rate}%` : "—"}
          subLabel={stats ? `${pluralize(stats.emails_sent, "follow-up")} sent` : undefined}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={statsLoading}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search product, customer, comment…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <SingleSelect
            options={FEEDBACK_RATING_FILTER_OPTIONS}
            value={rating}
            onChange={(v) => {
              setRating(v);
              setPage(1);
            }}
            className="sm:w-48 sm:shrink-0"
          />
        </div>
        {isLoading ? (
          <div className="p-5">
            <SkeletonText lines={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquareHeart}
            title={search || rating !== ALL ? "No feedback matches" : "No feedback yet"}
            description="Ratings from follow-up emails land here. Switch on a follow-up in the Follow-ups tab to start asking."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>Rating</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((f) => (
                  <TableRow key={f._id}>
                    <TableCell>
                      <RatingStars rating={f.rating} />
                      <div className="mt-1 text-2xs text-fg/45">{new Date(f.updated_at).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="truncate text-fg">{f.product_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-fg">{f.customer_name || "—"}</div>
                      <a href={`mailto:${f.customer_email}`} className="truncate text-xs text-accent hover:underline">
                        {f.customer_email}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal text-sm text-fg/70">{f.comment || <span className="text-fg/35">—</span>}</TableCell>
                    <TableCell className="text-right">
                      {f.order_id ? (
                        <Link to={`/orders/${f.order_id}`} className="text-sm text-accent hover:underline">
                          {f.order_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={data?.data?.totalPages ?? 1}
          totalItems={data?.data?.total ?? 0}
          itemsPerPage={limit}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
