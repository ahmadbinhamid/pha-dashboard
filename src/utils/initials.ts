// Avatar initials from a person's name, shared so the Topbar account menu and Profile page's identity card can't drift apart again (they already did once).
export function personInitials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return (a + b || a || "PH").toUpperCase();
}
