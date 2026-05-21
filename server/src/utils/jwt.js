// utils/jwt.js

const jwt = require("jsonwebtoken");
const config = require("../config");

const signJwt = (payload, options = {}) => {
  const secret = config.jwt.secret;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const expiresIn = options.expiresIn || config.jwt.expiresIn || "1d";
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyJwt = (token) => {
  const secret = config.jwt.secret;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret); // throws if invalid/expired
};

module.exports = { signJwt, verifyJwt };
