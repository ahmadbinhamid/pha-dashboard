// controllers/customer.controller.js

const customerService = require("../services/customer.service");
const { success, created, notFound, requestConflict, systemfailure } = require("../utils/http/response");

exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const { items, total } = await customerService.listCustomers(
      { skip, limit, search: req.query.search },
      req.tenantId,
    );

    return success(res, {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id, req.tenantId);
    if (!customer) return notFound(res, "Customer not found");
    return success(res, customer);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const customer = await customerService.createCustomer(req.body, req.tenantId);
    return created(res, customer, "Customer created");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, "A customer with this email already exists");
    return systemfailure(res, err);
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body, req.tenantId);
    if (!customer) return notFound(res, "Customer not found");
    return success(res, customer, "Customer updated");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, "A customer with this email already exists");
    return systemfailure(res, err);
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await customerService.deleteCustomer(req.params.id, req.tenantId);
    if (!customer) return notFound(res, "Customer not found");
    return success(res, null, "Customer deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
