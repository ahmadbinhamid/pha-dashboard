// constants/googleProductCategory.constants.js
// Auto-parts subset of Google's product taxonomy, verified against
// taxonomy-with-ids.en-US.txt (Google_Product_Taxonomy_Version: 2021-09-21).
// Offered as the default pick-list and as name-based suggestions; never auto-applied.
// `keywords` drive suggestGoogleCategory — order matters: more specific entries first win.

const GOOGLE_AUTO_PARTS_CATEGORIES = Object.freeze([
  { id: "5613", name: "Vehicles & Parts > Vehicle Parts & Accessories", keywords: [] },
  { id: "899", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts", keywords: [] },
  { id: "2977", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Braking", keywords: ["brake", "disc", "rotor", "pad", "caliper"] },
  { id: "8232", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Carpet & Upholstery", keywords: ["carpet", "upholstery", "trim"] },
  { id: "2805", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Climate Control", keywords: ["air con", "aircon", "climate", "heater", "radiator", "cooling", "a/c"] },
  { id: "8235", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Controls", keywords: ["pedal", "steering wheel", "controls", "shifter"] },
  { id: "2550", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Engine Oil Circulation", keywords: ["oil pump", "oil cooler", "oil filter", "sump"] },
  { id: "2820", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Engine Parts", keywords: ["engine part", "gasket", "piston", "timing", "belt", "camshaft", "valve"] },
  { id: "8137", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Engines", keywords: ["engine", "motor"] },
  { id: "908", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Exhaust", keywords: ["exhaust", "muffler", "catalytic"] },
  { id: "8227", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Frame & Body Parts", keywords: ["body", "panel", "bumper", "bonnet", "door", "guard", "fender"] },
  { id: "2727", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Fuel Systems", keywords: ["fuel", "injector", "pump"] },
  { id: "8233", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Interior Fittings", keywords: ["interior", "dash", "console"] },
  { id: "3318", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Lighting", keywords: ["light", "lamp", "headlight", "tail light", "globe", "led"] },
  { id: "2642", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Mirrors", keywords: ["mirror"] },
  { id: "8231", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Power & Electrical Systems", keywords: ["electrical", "alternator", "starter", "battery", "wiring", "ecu"] },
  { id: "8238", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Seating", keywords: ["seat"] },
  { id: "8234", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Sensors & Gauges", keywords: ["sensor", "gauge"] },
  { id: "2935", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Suspension Parts", keywords: ["suspension", "shock", "strut", "spring", "control arm", "bush"] },
  { id: "8228", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Towing", keywords: ["tow", "hitch"] },
  { id: "2641", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Transmission & Drivetrain Parts", keywords: ["transmission", "gearbox", "clutch", "driveshaft", "cv", "diff", "drivetrain"] },
  { id: "3020", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems", keywords: ["wheel", "rim", "hub", "bearing", "tyre", "tire"] },
  { id: "2534", name: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Window Parts & Accessories", keywords: ["window", "wiper", "windscreen", "glass"] },
]);

// General fallback suggestion when no keyword matches (Motor Vehicle Parts).
const GOOGLE_DEFAULT_PARTS_CATEGORY_ID = "899";

module.exports = { GOOGLE_AUTO_PARTS_CATEGORIES, GOOGLE_DEFAULT_PARTS_CATEGORY_ID };
