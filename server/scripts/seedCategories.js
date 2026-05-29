// scripts/seedCategories.js
// Seed auto-parts categories into the database.
// Usage: node scripts/seedCategories.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Category = require("../src/models/Category");
const { generateSlug, ensureUniqueSlug } = require("../src/utils/slug");

const CATEGORIES = [
  { name: "Engine & Drivetrain", sort_order: 1 },
  { name: "Brakes & Suspension", sort_order: 2 },
  { name: "Electrical & Lighting", sort_order: 3 },
  { name: "Body & Exterior", sort_order: 4 },
  { name: "Interior & Accessories", sort_order: 5 },
  { name: "Cooling & Heating", sort_order: 6 },
  { name: "Exhaust & Emissions", sort_order: 7 },
  { name: "Wheels & Tyres", sort_order: 8 },
  { name: "Transmission & Gearbox", sort_order: 9 },
  { name: "Filters & Fluids", sort_order: 10 },
];

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  let created = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const baseSlug = generateSlug(cat.name);
    const existing = await Category.findOne({ slug: baseSlug });

    if (existing) {
      console.log(`  [skip] "${cat.name}" already exists`);
      skipped++;
      continue;
    }

    const slug = await ensureUniqueSlug(Category, baseSlug);
    await Category.create({
      name: cat.name,
      slug,
      parent: null,
      sort_order: cat.sort_order,
    });

    console.log(`  [ok]   "${cat.name}" → /${slug}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
