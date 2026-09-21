// Avatar initials from a person's name. Shared because the Topbar's account
// menu and the Profile page's identity card have to agree — two copies of
// this drifted once already (one upper-cased, one didn't).
export function personInitials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return (a + b || a || "PH").toUpperCase();
}
