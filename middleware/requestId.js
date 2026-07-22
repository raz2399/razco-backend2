const { v4: uuidv4 } = require('uuid');

module.exports = (req, res, next) => {
  const id = uuidv4();
  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
