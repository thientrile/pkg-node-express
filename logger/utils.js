// Logger utilities: request logging & init steps
// Assumes Mylogger instance provided (from myLogger.js)

// Generate a lightweight request id
function genRequestId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Express-style middleware to log request & response lifecycle.
 * @param {Mylogger} logger
 * @param {Object} opts
 * @param {boolean} opts.includeHeaders - log request headers (sanitized)
 * @param {boolean} opts.includeQuery - log query params
 * @param {boolean} opts.includeBody - log body (exclude large / sensitive fields)
 */
export function requestLoggerMiddleware(logger, opts = {}) {
  const {
    includeHeaders = false,
    includeQuery = true,
    includeBody = true,
    slowThresholdMs = 1000 // mark slow responses
  } = opts;

  return function requestLogger(req, res, next) {
    const start = Date.now();
    req.requestId = req.headers['x-request-id'] || genRequestId();

    const metaIn = {};
    if (includeQuery && req.query && Object.keys(req.query).length) metaIn.query = req.query;
    if (includeBody && req.body && Object.keys(req.body).length) metaIn.body = shrinkBody(req.body);
    if (includeHeaders) metaIn.headers = shrinkHeaders(req.headers);
    metaIn.ip = req.ip || req.connection?.remoteAddress;

    logger.info(`Incoming ${req.method} ${req.originalUrl || req.url}`, ['REQUEST', req, metaIn]);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const metaOut = {
        status: res.statusCode,
        duration,
        slow: duration >= slowThresholdMs ? true : undefined,
        length: res.getHeader('content-length') || undefined
      };
      logger.info(`Response ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`, ['RESPONSE', req, metaOut]);
    });

    next();
  };
}

/**
 * Log an initialization step
 * @param {Mylogger} logger
 * @param {string} step
 * @param {object} metadata
 */
export function logInitStep(logger, step, metadata = {}) {
  logger.info(step, ['SYSTEM', null, metadata]);
}

/**
 * Convenience to create & init logger in one step.
 * @param {Class} LoggerClass - pass the class (e.g., Mylogger)
 * @param {object} options - options future-proof
 */
export function initLogger(LoggerClass, options = {}) {
  const logger = new LoggerClass(options);
  logger.info('Logger initialized', ['LOGGER_INIT', null, { pid: process.pid, env: process.env.NODE_ENV }]);
  return logger;
}

// Avoid logging huge payloads
function shrinkBody(body) {
  try {
    if (typeof body !== 'object' || body == null) return body;
    const clone = { ...body };
    for (const k of Object.keys(clone)) {
      const v = clone[k];
      if (typeof v === 'string' && v.length > 500) clone[k] = v.slice(0, 500) + '...<truncated>'; // truncate long strings
      if (Array.isArray(v) && v.length > 50) clone[k] = `[Array length=${v.length}]`; // summarise large arrays
      if (typeof v === 'object' && v !== null) {
        const keys = Object.keys(v);
        if (keys.length > 50) clone[k] = `{Object keys=${keys.length}}`; // summarise huge objects
      }
    }
    return clone;
  } catch {
    return '[unserializable-body]';
  }
}

function shrinkHeaders(headers = {}) {
  const allow = ['user-agent', 'accept', 'content-type', 'x-forwarded-for'];
  const out = {};
  for (const k of allow) if (headers[k]) out[k] = headers[k];
  return out;
}
