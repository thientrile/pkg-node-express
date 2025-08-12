export const handleUserAgent = (req) => {
  const ua = req.headers["user-agent"] || "";
  return {
    ip: req.ip || req.connection?.remoteAddress,
    ua,
    requestId: req.headers["x-request-id"] || req.requestId,
  };
};
