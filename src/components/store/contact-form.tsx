"use client";

import { StoreButton } from "@/components/store/ui/button";
import { StoreInput } from "@/components/store/ui/input";
import { useToast } from "@/components/toast/toast-provider";

export function ContactForm() {
  const { toast } = useToast();
  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        toast({ tone: "success", title: "Message sent (demo)", description: "Connect to email API later." });
      }}
    >
      <StoreInput required name="name" placeholder="Name" />
      <StoreInput required type="email" name="email" placeholder="Email" />
      <StoreInput name="subject" placeholder="Subject" />
      <textarea
        name="body"
        required
        placeholder="How can we help?"
        className="min-h-[140px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <StoreButton type="submit">Send message</StoreButton>
    </form>
  );
}
