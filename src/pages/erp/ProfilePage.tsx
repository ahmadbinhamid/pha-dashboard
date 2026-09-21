import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileInformationForm } from "@/components/profile/ProfileInformationForm";
import { SecuritySettingsCard } from "@/components/profile/SecuritySettingsCard";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import {
  ProfileSectionNav,
  findProfileSection,
  type ProfileSectionId,
} from "@/components/profile/ProfileSectionNav";
import { useAuth } from "@/context/auth";

// Side nav + the active section's body, the same two-level shape as Settings.
// The section lives in the URL (?section=password) rather than in component
// state, so it survives a refresh and can be linked to — and each card keeps
// its own Save, instead of one header button that means something different
// per section.
//
// Signing out lives in the Topbar account menu (UserMenu), not here.
export default function ProfilePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = findProfileSection(searchParams.get("section"));

  function selectSection(id: ProfileSectionId) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "profile") next.delete("section");
        else next.set("section", id);
        return next;
      },
      { replace: true },
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={section === "password" ? "Change Password" : "Profile"}
        description={
          section === "password"
            ? "Choose a new password for your account."
            : "Your account details and how your name appears across the store."
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <ProfileSectionNav activeId={section} onSelect={selectSection} />
        </aside>

        <div className="min-w-0 max-w-3xl flex-1 space-y-6">
          {section === "password" ? (
            <ChangePasswordForm />
          ) : (
            <>
              <ProfileInformationForm user={user} />
              <SecuritySettingsCard user={user} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
