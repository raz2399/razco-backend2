const { validationResult } = require('express-validator');
const customerService = require('../services/customer.service');
const { success, error, validationError } = require('../utils/response');
const logger = require('../utils/logger');

async function signup(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors.array());
    }

    const { name, phone, email, smsOptIn } = req.body;

    const result = customerService.signup({ name, phone, email, smsOptIn });

    const message = result.isNew
      ? `Welcome to Razco Foods, ${result.customer.name}!`
      : `Welcome back, ${result.customer.name}!`;

    return success(res, result, message, result.isNew ? 201 : 200);
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode, err.code);
    }
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const result = customerService.getAll({
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 200),
      search: search || '',
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const customer = customerService.getById(parseInt(req.params.id));
    if (!customer) return error(res, 'Customer not found', 404, 'NOT_FOUND');
    return success(res, { customer });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = customerService.getHistory(parseInt(req.params.id));
    return success(res, history);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, getAll, getById, getHistory };
