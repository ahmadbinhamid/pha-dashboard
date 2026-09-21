// config/permissions.js
//
// The permission catalogue: every action a role can be granted, as a
// `group.action` string (e.g. "orders.refund"). This file is the single
// source of truth — roles store the strings they were granted and are
// validated against this list, so a permission that isn't here cannot be
// saved, and removing one here retires it everywhere.
//
// Modelled on flowpos-backend's config/permissions.php, over this product's
// own feature set. `label`/`description` live here too (rather than only in
// the dashboard) so the permission matrix in Settings → Roles renders from
// the same list the server enforces, and the two can't drift.

const PERMISSION_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "The landing page's figures and charts.",
    actions: { view: "View the dashboard" },
  },
  {
    key: "products",
    label: "Products",
    description: "The parts catalogue, its pricing and its media.",
    actions: {
      view: "View products",
      create: "Add products",
      update: "Edit products and pricing",
      delete: "Delete products",
    },
  },
  {
    key: "categories",
    label: "Categories",
    description: "How the catalogue is organised.",
    actions: { view: "View categories", create: "Add categories", update: "Edit categories", delete: "Delete categories" },
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock on hand, adjustments and stock history.",
    actions: { view: "View stock levels", update: "Adjust stock", export: "Export inventory" },
  },
  {
    key: "orders",
    label: "Orders",
    description: "Sales across every channel, and what happens to them after the sale.",
    actions: {
      view: "View orders",
      create: "Create orders (incl. in-store sales)",
      update: "Edit orders and line pricing",
      delete: "Cancel orders",
      refund: "Issue refunds",
      export: "Export orders",
    },
  },
  {
    key: "payments",
    label: "Payments",
    description: "Payments taken, payment links and their reconciliation.",
    actions: { view: "View payments", create: "Take payments and issue links", refund: "Refund payments", export: "Export payments" },
  },
  {
    key: "customers",
    label: "Customers",
    description: "Customer records and their order history.",
    actions: { view: "View customers", create: "Add customers", update: "Edit customers", delete: "Delete customers" },
  },
  {
    key: "listings",
    label: "Listings",
    description: "What is published to eBay and Google Shopping.",
    actions: { view: "View listings", create: "Create listings", update: "Edit and push listings", delete: "End listings" },
  },
  {
    key: "reports",
    label: "Reports",
    description: "Revenue, profitability and stock-velocity reporting.",
    actions: { view: "View reports", export: "Export report data" },
  },
  {
    key: "locations",
    label: "Warehouses & Hubs",
    description: "The sites stock is counted against.",
    actions: { view: "View locations", create: "Add locations", update: "Edit locations", delete: "Remove locations" },
  },
  {
    key: "settings",
    label: "Store Settings",
    description: "Trading identity, invoice setup, policies and branding.",
    actions: { view: "View settings", update: "Change settings" },
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "eBay, Google, Stripe, email and domains — including their credentials.",
    actions: { view: "View integrations", update: "Connect and configure integrations" },
  },
  {
    key: "users",
    label: "User Management",
    description: "Who belongs to this organisation.",
    actions: {
      view: "View members and invitations",
      create: "Invite members",
      update: "Change a member's role or access",
      delete: "Remove members",
    },
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    description: "What each role is allowed to do. Grant with care — it implies every other permission.",
    actions: { view: "View roles", create: "Create roles", update: "Edit roles", delete: "Delete roles" },
  },
  {
    key: "activity",
    label: "Activity Log",
    description: "The audit trail of who changed what.",
    actions: { view: "View the activity log" },
  },
];

/** Every valid permission string, e.g. ["dashboard.view", "orders.refund", ...]. */
const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) =>
  Object.keys(group.actions).map((action) => `${group.key}.${action}`),
);

const PERMISSION_SET = new Set(ALL_PERMISSIONS);

function isValidPermission(permission) {
  return PERMISSION_SET.has(permission);
}

/** The subset of `permissions` that isn't in the catalogue — [] when all are valid. */
function unknownPermissions(permissions = []) {
  return permissions.filter((p) => !PERMISSION_SET.has(p));
}

/** Every permission in a group, e.g. groupPermissions("orders"). */
function groupPermissions(groupKey) {
  const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
  return group ? Object.keys(group.actions).map((action) => `${group.key}.${action}`) : [];
}

module.exports = {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  isValidPermission,
  unknownPermissions,
  groupPermissions,
};
