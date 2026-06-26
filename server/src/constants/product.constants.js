// constants/product.constants.js

const PRODUCT_TYPE = Object.freeze({
  PHYSICAL: "physical",
  DIGITAL: "digital",
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
});

module.exports = { PRODUCT_TYPE, PRODUCT_STATUS };
