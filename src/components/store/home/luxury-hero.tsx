
import Link from "@/components/ui/link";
import { Image } from "@/components/ui/image";
import { useRouter } from "@/hooks";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LuxurySelect } from "@/components/store/home/luxury-select";
import { VEHICLE_SEARCH } from "@/lib/store/data/home-mock";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&q=85";

export function LuxuryHero() {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");

  const makeOptions = useMemo(
    () => VEHICLE_SEARCH.makes.map((m) => ({ value: m, label: m })),
    [],
  );
  const modelOptions = useMemo(() => {
    const list = make ? VEHICLE_SEARCH.modelsByMake[make] ?? [] : [];
    return list.map((m) => ({ value: m, label: m }));
  }, [make]);
  const yearOptions = useMemo(
    () => VEHICLE_SEARCH.years.map((y) => ({ value: y, label: y })),
    [],
  );
  const categoryOptions = useMemo(
    () => VEHICLE_SEARCH.partCategories.map((c) => ({ value: c, label: c })),
    [],
  );

  const scrollToVehicle = () => {
    document.getElementById("vehicle-search")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[85svh] overflow-hidden sm:min-h-[88svh]">
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        className="object-center"
      />
      <div
        className="absolute inset-0 bg-linear-to-t from-luxury-ink via-luxury-ink/85 to-luxury-ink/55"
        aria-hidden
      />
      <div className="absolute inset-0 bg-linear-to-r from-luxury-ink/90 via-transparent to-luxury-ink/70" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[85svh] max-w-6xl flex-col justify-center px-4 pb-[max(5rem,env(safe-area-inset-bottom))] pt-[max(6.5rem,env(safe-area-inset-top))] sm:min-h-[88svh] sm:px-6 sm:pb-20 sm:pt-28 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="mx-auto max-w-4xl animate-fade-slide text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold">
            Parts Hub Australia
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem]">
            Premium European &amp; German Auto Parts
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/65 sm:text-lg">
            Genuine <span className="text-white/90">|</span> OEM <span className="text-white/90">|</span>{" "}
            Performance <span className="text-white/90">|</span> Used Parts
          </p>

          <div className="mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <Button asChild size="lg" className="min-h-12 w-full min-w-0 px-6 sm:min-w-[180px] sm:max-w-[280px]">
              <Link href="/parts">Shop parts</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12 w-full min-w-0 border-white/25 bg-white/5 px-6 text-white backdrop-blur-sm hover:bg-white/10 hover:text-white sm:min-w-[180px] sm:max-w-[280px]"
              onClick={scrollToVehicle}
            >
              Search by vehicle
            </Button>
          </div>
        </div>

        <div
          id="vehicle-search"
          className="mx-auto mt-14 w-full max-w-5xl animate-fade-slide"
          style={{ animationDelay: "120ms" }}
        >
          <div className="rounded-2xl border border-white/10 bg-luxury-panel/85 p-4 shadow-glow backdrop-blur-xl sm:p-6">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-fg/50">
              Find parts for your vehicle
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LuxurySelect
                placeholder="Make"
                value={make}
                onChange={(v) => {
                  setMake(v);
                  setModel("");
                }}
                options={makeOptions}
              />
              <LuxurySelect
                placeholder="Model"
                value={model}
                onChange={setModel}
                options={modelOptions}
              />
              <LuxurySelect placeholder="Year" value={year} onChange={setYear} options={yearOptions} />
              <LuxurySelect
                placeholder="Part category"
                value={category}
                onChange={setCategory}
                options={categoryOptions}
              />
            </div>
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                size="lg"
                className="min-w-[200px]"
                onClick={() => {
                  const p = new URLSearchParams();
                  if (make) p.set("make", make);
                  if (model) p.set("model", model);
                  if (year) p.set("year", year);
                  if (category) p.set("category", category);
                  router.push(p.toString() ? `/parts?${p.toString()}` : "/parts");
                }}
              >
                Search catalogue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
