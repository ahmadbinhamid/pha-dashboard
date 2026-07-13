// models/VehicleModel.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");

const vehicleModelSchema = buildSchema(
  {
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    model_code: { type: String, default: "", trim: true },
    year_from: { type: Number, required: true },
    year_to: { type: Number, default: null },
  },
  { softDelete: false },
);

vehicleModelSchema.index({ make: 1, model: 1, model_code: 1 }, { unique: true });

module.exports = model("VehicleModel", vehicleModelSchema);
