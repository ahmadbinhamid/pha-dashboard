// constants/user.constants.js

const USER_ROLE = Object.freeze({
  USER: "user",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
});

const USER_STATUS = Object.freeze({
  INACTIVE: "inactive",
  ACTIVE: "active",
});

module.exports = { USER_ROLE, USER_STATUS };
