export interface AuthUser {
  _id: string;
  tenant_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  role: "user" | "admin" | "superadmin";
  status: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// Local form state for the Profile Settings page — mirrors the fields
// PUT /user (updateProfile) actually accepts.
export interface ProfileFormState {
  first_name: string;
  last_name: string;
}

// Local form state for the Change Password section — mirrors
// changePassword's payload plus the client-only confirm field.
export interface PasswordFormState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
