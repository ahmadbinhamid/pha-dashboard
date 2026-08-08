import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { registerTenant } from "@/lib/api/auth";
import { useAuth } from "@/context/auth";

import { ArrowRight } from "lucide-react";
import { AppLogoMark, APP_NAME } from "@/components/branding/AppLogoMark";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import Link from "@/components/ui/Link";
import { registerFormSchema, type RegisterFormValues } from "@/lib/validation/register";

export function RegisterCard() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { company_name: "", first_name: "", last_name: "", email: "", password: "" },
  });

  const registerMutation = useMutation({
    mutationFn: registerTenant,
    // Active immediately — a brand-new tenant has no other admin to approve
    // this account, so signup logs straight in, same as login's onSuccess.
    onSuccess: (res) => {
      if (!res.token || !res.data) {
        setErrorMsg("Unexpected server response. Please try again.");
        return;
      }
      setAuth(res.data, res.token);
      navigate("/dashboard", { replace: true });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const isLoading = registerMutation.isPending;

  const onSubmit = (values: RegisterFormValues) => {
    setErrorMsg("");
    registerMutation.mutate({
      company_name: values.company_name.trim(),
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });
  };

  return (
    <div className="w-full max-w-105">
      <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AppLogoMark className="h-20 w-20 shadow-soft ring-1 ring-inset ring-[hsl(var(--accent)/0.28)]" />
        <div className="text-left">
          <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
          <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
        </div>
      </div>

      <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">
        <CardHeader
          title="Create your account"
          description="Set up your own workspace — you'll be its first admin."
        />
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Company name" htmlFor="company_name" error={errors.company_name?.message}>
              <Input
                id="company_name"
                type="text"
                placeholder="Acme Auto Parts"
                autoComplete="organization"
                disabled={isLoading}
                {...register("company_name")}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" htmlFor="first_name" error={errors.first_name?.message}>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Jane"
                  autoComplete="given-name"
                  disabled={isLoading}
                  {...register("first_name")}
                />
              </FormField>
              <FormField label="Last name" htmlFor="last_name" error={errors.last_name?.message}>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  autoComplete="family-name"
                  disabled={isLoading}
                  {...register("last_name")}
                />
              </FormField>
            </div>

            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                placeholder="you@partshub.com.au"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
              />
            </FormField>

            <FormField label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                disabled={isLoading}
                {...register("password")}
              />
            </FormField>

            {errorMsg && (
              <p className="rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-xs text-[hsl(var(--danger))]">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account…" : "Create account"}
              <span className="ml-2 opacity-80">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>

            <div className="pt-2 text-center text-xs text-fg/55">
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </div>

            <div className="text-center text-xs text-fg/55">
              By continuing you agree to the{" "}
              <Link href="#" className="text-fg/70 hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-fg/70 hover:underline">
                Privacy Policy
              </Link>
              .
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
