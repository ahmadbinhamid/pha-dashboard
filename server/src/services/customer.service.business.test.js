// services/customer.service.business.test.js
// Reps of one business: shared inbox, separate records, search and migration.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");

const Customer = require("../models/Customer");
const Business = require("../models/Business");
const customerService = require("./customer.service");
const { migrateCustomerCompanies } = require("./business-migration.service");
const representativeService = require("./representative.service");
const businessService = require("./business.service");
const { createBusiness: createBusinessValidation } = require("../validators/business.validation");

before(async () => {
  await mongoose.connect(config.mongoUri);
  await Promise.all([Customer.init(), Business.init()]);
});
after(() => mongoose.disconnect());

const INBOX = "accounts@abcmotors.com.au";

test("two reps of one business can share an email and stay separate", async () => {
  const tenantId = fixtureId();
  const john = await customerService.createCustomer({ name: "John Smith", business_name: "ABC Motors", email: INBOX }, tenantId);
  const david = await customerService.createCustomer({ name: "David Smith", business_name: "abc motors ", email: INBOX }, tenantId);

  assert.notEqual(String(john._id), String(david._id));
  assert.equal(String(john.business_id), String(david.business_id));
  assert.equal(john.business.name, "ABC Motors");
  assert.equal(await Business.countDocuments({ tenant_id: tenantId }), 1);
});

test("the same rep twice in one business is rejected, case aside", async () => {
  const tenantId = fixtureId();
  await customerService.createCustomer({ name: "John Smith", business_name: "ABC Motors", email: INBOX }, tenantId);
  await assert.rejects(
    customerService.createCustomer({ name: "john smith", business_name: "ABC Motors", email: INBOX }, tenantId),
    (err) => err.code === 11000,
  );
});

test("customers without a business still need a unique email", async () => {
  const tenantId = fixtureId();
  await customerService.createCustomer({ name: "Jo Fix", email: "jo@example.com" }, tenantId);
  await assert.rejects(
    customerService.createCustomer({ name: "Jo Other", email: "jo@example.com" }, tenantId),
    (err) => err.code === 11000,
  );
});

test("search finds reps by name, and every rep by business name", async () => {
  const tenantId = fixtureId();
  await customerService.createCustomer({ name: "John Smith", business_name: "ABC Motors", email: INBOX }, tenantId);
  await customerService.createCustomer({ name: "David Smith", business_name: "ABC Motors", email: INBOX }, tenantId);
  await customerService.createCustomer({ name: "Sarah Jones", business_name: "XYZ Auto Group" }, tenantId);

  const byName = await customerService.listCustomers({ search: "David" }, tenantId);
  assert.deepEqual(byName.items.map((c) => c.name), ["David Smith"]);
  assert.equal(byName.items[0].business.name, "ABC Motors");

  const byBusiness = await customerService.listCustomers({ search: "abc" }, tenantId);
  assert.deepEqual(byBusiness.items.map((c) => c.name).sort(), ["David Smith", "John Smith"]);
});

test("a rep's profile lists the other reps of the business", async () => {
  const tenantId = fixtureId();
  const john = await customerService.createCustomer({ name: "John Smith", business_name: "ABC Motors", email: INBOX }, tenantId);
  await customerService.createCustomer({ name: "David Smith", business_name: "ABC Motors", email: INBOX }, tenantId);

  const detail = await customerService.getCustomerById(john._id, tenantId);
  assert.deepEqual(detail.representatives.map((r) => r.name), ["David Smith"]);
});

test("clearing the business name unlinks the customer", async () => {
  const tenantId = fixtureId();
  const john = await customerService.createCustomer({ name: "John Smith", business_name: "ABC Motors" }, tenantId);
  const updated = await customerService.updateCustomer(john._id, { business_name: "" }, tenantId);
  assert.equal(updated.business_id, null);
  assert.equal(updated.business, null);
});

test("migration links legacy company names to one business per name", async () => {
  const tenantId = fixtureId();
  const legacy = (name, company_name) => ({ tenant_id: tenantId, name, company_name, business_id: null, deleted_at: null });
  await Customer.collection.insertMany([
    legacy("John Smith", "ABC Motors"),
    legacy("David Smith", " abc motors"),
    legacy("Walk In", null),
  ]);

  const dryRows = await migrateCustomerCompanies({ dryRun: true, tenantId: String(tenantId) });
  assert.deepEqual(dryRows.map((r) => [r.customers, r.action]), [[2, "would link"]]);
  assert.equal(await Business.countDocuments({ tenant_id: tenantId }), 0);

  await migrateCustomerCompanies({ dryRun: false, tenantId: String(tenantId) });
  const linked = await Customer.find({ tenant_id: tenantId, business_id: { $ne: null } }).lean();
  assert.equal(linked.length, 2);
  assert.equal(String(linked[0].business_id), String(linked[1].business_id));
  assert.deepEqual(await migrateCustomerCompanies({ dryRun: true, tenantId: String(tenantId) }), []);
});

test("a business is created with several reps sharing one inbox", async () => {
  const tenantId = fixtureId();
  const business = await representativeService.createBusinessWithRepresentatives(tenantId, {
    name: "ABC Motors",
    representatives: [{ name: "John Smith", email: INBOX }, { name: "David Smith", email: INBOX }],
  });
  assert.deepEqual(business.representatives.map((r) => r.name), ["John Smith", "David Smith"]);

  const { items } = await representativeService.listBusinesses({}, tenantId);
  assert.deepEqual(items.map((b) => [b.name, b.representatives_count]), [["ABC Motors", 2]]);
});

test("a failed rep insert leaves no business or reps behind", async () => {
  const tenantId = fixtureId();
  await assert.rejects(
    representativeService.createBusinessWithRepresentatives(tenantId, {
      name: "ABC Motors",
      representatives: [{ name: "John Smith", email: INBOX }, { name: "JOHN SMITH", email: INBOX }],
    }),
    (err) => err.code === 11000,
  );
  assert.equal(await Business.countDocuments({ tenant_id: tenantId }), 0);
  assert.equal(await Customer.countDocuments({ tenant_id: tenantId }), 0);
});

test("the validator rejects the same rep twice before touching the DB", () => {
  const { error } = createBusinessValidation.body.validate({
    name: "ABC Motors",
    representatives: [{ name: "John Smith", email: INBOX }, { name: "john smith", email: INBOX }],
  });
  assert.match(error.message, /different name or email/);
});

test("a business with reps cannot be deleted, an empty one can", async () => {
  const tenantId = fixtureId();
  const busy = await representativeService.createBusinessWithRepresentatives(tenantId, {
    name: "ABC Motors",
    representatives: [{ name: "John Smith" }],
  });
  await assert.rejects(representativeService.deleteBusiness(busy._id, tenantId), (err) => err.status === 409);

  const empty = await representativeService.createBusinessWithRepresentatives(tenantId, { name: "Empty Co" });
  await representativeService.deleteBusiness(empty._id, tenantId);
  assert.equal(await businessService.getBusinessById(empty._id, tenantId), null);
});

test("renaming to another business's name is a conflict", async () => {
  const tenantId = fixtureId();
  await businessService.createBusiness(tenantId, "ABC Motors");
  const xyz = await businessService.createBusiness(tenantId, "XYZ Auto Group");
  await assert.rejects(businessService.renameBusiness(xyz._id, tenantId, "abc motors"), (err) => err.code === 11000);
});
