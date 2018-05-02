var jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  /**
   * Verifies that the passed JWT token is ok. If nok it will respond with
   * 403 forbidden
   *
   * Saves authData as res.locals.authData
   */

  const bearerHeader = req.headers["authorization"];
  if (typeof bearerHeader !== "undefined") {
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];
    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
      if (err) {
        res.sendStatus(403);
      } else {
        res.locals.authData = authData;
        next();
      }
    });
  } else {
    res.sendStatus(403);
  }
}

module.exports = verifyToken;
