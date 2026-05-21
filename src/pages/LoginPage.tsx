import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-clip overflow-y-auto bg-bg">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, rgba(0,118,255,0.18), transparent 60%), radial-gradient(900px 500px at 85% 35%, rgba(245,158,11,0.14), transparent 55%), radial-gradient(700px 600px at 50% 110%, rgba(0,0,0,0.10), transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 noise" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-dvh items-center justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <LoginCard />
      </div>
    </main>
  );
}
