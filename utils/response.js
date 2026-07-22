function success(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
  });
}

function error(res, message = 'An error occurred', statusCode = 500, code = 'SERVER_ERROR', field = null) {
  const body = {
    success: false,
    error: { code, message },
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
  };
  if (field) body.error.field = field;
  return res.status(statusCode).json(body);
}

function validationError(res, errors) {
  return res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: errors,
    },
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { success, error, validationError };
