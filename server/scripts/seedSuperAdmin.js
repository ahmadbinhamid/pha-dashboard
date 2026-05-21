// scripts/seedSuperAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await User.syncIndexes();

    const email = process.env.SUPERADMIN_EMAIL || "superadmin@xyz.com";
    const password = process.env.SUPERADMIN_PASSWORD || "dewdrops123";
    const phone = process.env.SUPERADMIN_PHONE || null;

    const exists = await User.exists({ email });
    if (exists) {
      console.log(`Superadmin already exists: ${email}`);
    } else {
      await User.create({
        first_name: "Super",
        last_name: "Admin",
        email,
        password,
        role: "superadmin",
        phone,
        status: 1,
        verified_at: new Date(),
      });
      console.log(`SuperAdmin created: ${email}`);
    }
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
