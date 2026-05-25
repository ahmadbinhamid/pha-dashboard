export interface AuthUser {
  _id: string;
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
