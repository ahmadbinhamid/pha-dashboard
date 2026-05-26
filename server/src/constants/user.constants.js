// constants/user.constants.js

const USER_ROLE = Object.freeze({
  USER: "user",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
});

const USER_STATUS = Object.freeze({
  INACTIVE: 0,
  ACTIVE: 1,
});

module.exports = { USER_ROLE, USER_STATUS };
