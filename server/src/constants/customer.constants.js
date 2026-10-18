// constants/customer.constants.js
// Where a customer record came from.

// staff: added in the dashboard, storefront: captured from a website order.
const CUSTOMER_SOURCE = Object.freeze({ STAFF: "staff", STOREFRONT: "storefront" });

module.exports = { CUSTOMER_SOURCE };
