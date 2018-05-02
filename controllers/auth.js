const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const saltRounds = 10;
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");

/******** Sign in ********/
router.post("/sign-in", parseForm, (req, res) => {
  /**
   * Get all the values you need
   * -> if any of them are missing, just go ahead and respond with an error
   * There's no point in looking up users to check if a password that wasn't
   * passed is valid!
   */
  try {
    var email = req.fields.email;
    var password = req.fields.password;
  } catch (err) {
    return sendError(res, "Email or password is missing");
  }

  // Creates empty user object (needs to be in scrop for the entire route function)
  let user = {};

  // Query and values
  let query =
    "SELECT user_id, email, first_name, last_name, password FROM users WHERE email = $1";
  let values = [email];

  // Query the db
  db
    .query(query, values)
    .then(dbRes => {
      // No user found return error
      if (dbRes.rowCount < 1)
        return sendError(res, "No users found with the specified email");

      // Create the user object
      user.id = dbRes.rows[0].user_id;
      user.email = dbRes.rows[0].email;
      user.firstName = dbRes.rows[0].first_name;
      user.lastName = dbRes.rows[0].last_name;

      // Check user credentials
      bcrypt
        .compare(password + process.env.PASSWORD_SECRET, dbRes.rows[0].password)
        .then(signIn) // passwords match
        .catch(() => {}); // If passwords don't match
    })
    .catch(err => {
      console.log(err);
      sendError(res, "code error");
    }); // If the db query has errors

  // The function that responds with the sign in token
  function signIn() {
    /**
     * Creates the JWT token.
     * -------
     * The token includes user details (id, email, firstName and lastName).
     * These will be available for every request to verify that the user
     * making the request isn't trying to spoof the system
     */
    jwt.sign(
      { user },
      process.env.JWT_SECRET, // secret
      { expiresIn: "7 days" }, // expiration
      (err, token) => {
        if (err) return sendError(res, "Unable to create auth-token");
        return res.json({
          status: "OK",
          message: "User signed in",
          token,
          user
        });
      }
    );
  }
});

/******** Check token ********/
router.post("/check-token", verifyToken, (req, res) => {
  if (res.locals.authData) {
    return res.json({
      status: "OK",
      message: "User is logged in",
      iat: res.locals.authData.iat,
      exp: res.locals.authData.exp
    });
  }
});

/******** Renew token ********/
router.post("/renew-token/:userId", verifyToken, (req, res) => {
  /**
   * Re-news the JWT token to b´´.
   */

  var user = res.locals.authData.user;

  // Checks if the user in the JWT token's id matches the userId passed to the route
  // If not, the token will not be renewed (If some hacker has access to the token
  // he also needs to know the users id to reenable the token. Otherwise the token
  // at least will be useless after maximum 7 days.)
  if (req.params.userId != user.id) {
    return sendError(res, "Could not renew auth-token");
  }

  jwt.sign(
    { user },
    process.env.JWT_SECRET, // secret
    { expiresIn: "7 days" }, // expiration
    (err, token) => {
      if (err) return sendError(res, "Could not renew auth-token");
      return res.json({
        status: "OK",
        message: "Renewed token",
        token,
        user
      });
    }
  );
});

module.exports = router;
