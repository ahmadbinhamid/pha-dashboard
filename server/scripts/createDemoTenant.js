// Creates a demo tenant with an active, verified Admin; skips existing emails.
// Usage: --email=<email> --password=<pw> [--company=<name>] [--confirm]

const { runScript } = require("../src/utils/scriptCli");
const { registerTenantWithAdmin } = require("../src/services/tenant.service");
const { findAllUsersByEmail } = require("../src/services/user.service");

const DEFAULT_COMPANY = "AutoPartsPro Demo";

function flag(name) {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function readArgs() {
  const email = flag("email")?.trim().toLowerCase();
  const password = flag("password");
  if (!email || !password) throw new Error("Usage: node scripts/createDemoTenant.js --email=<email> --password=<pw> [--company=<name>] [--confirm]");
  return { email, password, company: flag("company") || DEFAULT_COMPANY };
}

async function main({ confirm }, log) {
  const { email, password, company } = readArgs();
  const existing = await findAllUsersByEmail(email);
  if (existing.length) return log(`User ${email} already exists (tenant ${existing[0].tenant_id}). Nothing to do.`);
  if (!confirm) return log(`Dry run: would create tenant "${company}" with Admin ${email}. Re-run with --confirm.`);

  const { tenant, user } = await registerTenantWithAdmin({
    company_name: company,
    first_name: "Demo",
    last_name: "Tenant",
    email,
    password,
  });
  log(`Created tenant "${tenant.name}" (${tenant._id}, slug ${tenant.slug}) with Admin ${user.email} (${user._id}).`);
}

void runScript(main);
