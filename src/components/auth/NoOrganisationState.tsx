import { Building2 } from "lucide-react";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/auth";

// Signed in, but no active membership in any organisation.
export function NoOrganisationState() {
  const { logout } = useAuth();

  return (
    <AuthCardLayout>
      <CardContent className="flex flex-col items-center gap-4 pb-8">
        <EmptyState
          icon={Building2}
          title="You don't have access to an organisation"
          description="Your access was removed or suspended. Ask an organisation Admin to invite you, then open the link in their email."
          className="pb-0"
        />
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </CardContent>
    </AuthCardLayout>
  );
}
