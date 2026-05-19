import { Link } from "react-router-dom";
import { mockFetchBrandsSync } from "@/lib/store/api/catalog-mock";

export default function BrandsPage() {
  const brands = mockFetchBrandsSync();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Brands</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg/65">
        Shop by manufacturer. Counts reflect demo catalogue — will sync to your ERP inventory later.
      </p>
      <ul className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              to={`/parts?brand=${encodeURIComponent(b.name)}`}
              className="flex items-center justify-between px-5 py-4 text-sm transition hover:bg-bg-2/40"
            >
              <span className="font-semibold">{b.name}</span>
              <span className="text-fg/55">{b.count} parts</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
