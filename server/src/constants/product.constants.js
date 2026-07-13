// constants/product.constants.js

const PRODUCT_TYPE = Object.freeze({
  PHYSICAL: "physical",
  DIGITAL: "digital",
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
});

const PRODUCT_CONDITION = Object.freeze({
  NEW: "NEW",
  USED: "USED",
});

const PRODUCT_AUTHENTICITY = Object.freeze({
  GENUINE: "Genuine",
  AFTERMARKET: "Aftermarket",
});

module.exports = {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
};
