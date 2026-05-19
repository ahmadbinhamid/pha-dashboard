
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context";

export function ContactForm() {
  const { toast } = useToast();

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        toast({
          tone: "success",
          title: "Message sent (demo)",
          description: "Connect to email API in the Node.js backend later.",
        });
        (e.target as HTMLFormElement).reset();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-fg">
            Name <span className="text-danger" aria-hidden>*</span>
          </label>
          <Input id="contact-name" required name="name" placeholder="Your name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium text-fg">
            Email <span className="text-danger" aria-hidden>*</span>
          </label>
          <Input id="contact-email" required type="email" name="email" placeholder="you@example.com" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-phone" className="text-sm font-medium text-fg">
          Phone
        </label>
        <Input id="contact-phone" type="tel" name="phone" placeholder="+61 400 000 000" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-subject" className="text-sm font-medium text-fg">
          Subject
        </label>
        <Input id="contact-subject" name="subject" placeholder="Parts enquiry / fitment check / wholesale pricing…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-fg">
          Message <span className="text-danger" aria-hidden>*</span>
        </label>
        <textarea
          id="contact-message"
          name="body"
          required
          placeholder="Describe what you need — make, model, year, part name or OEM number."
          rows={5}
          className="min-h-[120px] w-full resize-y rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg shadow-sm outline-none placeholder:text-fg/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
