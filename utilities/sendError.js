function sendError(res, msg) {
  return res.json({
    status: "ERROR",
    msg: msg || "Unspecified error"
  });
}

module.exports = sendError;
