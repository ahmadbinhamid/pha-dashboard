// Permission keys, mirroring the server catalogue served by /roles/permissions.

export const PERMISSIONS = {
  dashboard: { view: "dashboard.view" },
  products: {
    view: "products.view",
    create: "products.create",
    update: "products.update",
    delete: "products.delete",
  },
  categories: {
    view: "categories.view",
    create: "categories.create",
    update: "categories.update",
    delete: "categories.delete",
  },
  inventory: { view: "inventory.view", update: "inventory.update", export: "inventory.export" },
  tags: { view: "tags.view", print: "tags.print", update: "tags.update" },
  orders: {
    view: "orders.view",
    create: "orders.create",
    update: "orders.update",
    delete: "orders.delete",
    refund: "orders.refund",
    export: "orders.export",
  },
  payments: {
    view: "payments.view",
    create: "payments.create",
    refund: "payments.refund",
    export: "payments.export",
  },
  customers: {
    view: "customers.view",
    create: "customers.create",
    update: "customers.update",
    delete: "customers.delete",
  },
  listings: {
    view: "listings.view",
    create: "listings.create",
    update: "listings.update",
    delete: "listings.delete",
  },
  reports: { view: "reports.view", export: "reports.export" },
  locations: {
    view: "locations.view",
    create: "locations.create",
    update: "locations.update",
    delete: "locations.delete",
  },
  shipping: { view: "shipping.view", update: "shipping.update" },
  settings: { view: "settings.view", update: "settings.update" },
  integrations: { view: "integrations.view", update: "integrations.update" },
  users: { view: "users.view", create: "users.create", update: "users.update", delete: "users.delete" },
  roles: { view: "roles.view", create: "roles.create", update: "roles.update", delete: "roles.delete" },
  activity: { view: "activity.view" },
} as const;

type PermissionCatalogue = typeof PERMISSIONS;

/** Any `group.action` key the server enforces. */
export type Permission = {
  [G in keyof PermissionCatalogue]: PermissionCatalogue[G][keyof PermissionCatalogue[G]];
}[keyof PermissionCatalogue];
