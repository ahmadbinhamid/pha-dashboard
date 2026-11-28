// utils/objectId.js
// ObjectId helpers for aggregation $match, which never casts strings.

const mongoose = require("mongoose");

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

module.exports = { toObjectId };
