// Libraries
const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../db");
const bcrypt = require("bcryptjs");
const request = require("request");

// Configuration
const saltRounds = 10;

// Utilities
const sendConfirmCodeEmail = require("../utilities/sendConfirmCodeEmail");
const sendConfirmCodePhone = require("../utilities/sendConfirmCodePhone");
const mailService = require("../utilities/mailService");
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const generateConfirmCode = require("../utilities/generateConfirmCode");

/******** Sign up ********/
router.post("/", parseForm, (req, res) => {
  // Get all the needed values
  var email = req.fields.email;
  var firstName = req.fields.firstName;
  var lastName = req.fields.lastName;
  var phone = req.fields.phone;
  var password = req.fields.password;
  var profilePicture = req.fields.profilePicture;
  var area = req.fields.area;
  var phoneConfirmCode = generateConfirmCode();
  var phoneConfirmHash = "";
  var emailConfirmCode = generateConfirmCode(12);
  var emailConfirmHash = "";

  // Check if any required values are undefined
  if (
    typeof email == "undefined" ||
    typeof firstName == "undefined" ||
    typeof lastName == "undefined" ||
    typeof phone == "undefined" ||
    typeof password == "undefined" ||
    typeof profilePicture == "undefined" ||
    typeof area == "undefined"
  ) {
    return sendError(res, "Not all fields are present");
  }

  // Describes the amount af async actions needed to complete before inserting a user
  // (it's all hashing functions so it should practically be instant)
  var jobCount = 3;

  // Hash password
  bcrypt.hash(password + process.env.PASSWORD_SECRET, saltRounds).then(hashedPassword => {
    password = hashedPassword;
    jobCount--;
    insertUser();
  });

  // Hash phone confirmation
  bcrypt.hash(phoneConfirmCode + process.env.VERIFICATION_SECRET, saltRounds).then(hashedPhoneConfirmCode => {
    phoneConfirmHash = hashedPhoneConfirmCode;
    jobCount--;
    insertUser();
  });

  // Hash email confirmation
  bcrypt.hash(emailConfirmCode + process.env.VERIFICATION_SECRET, saltRounds).then(hashedEmailConfirmCode => {
    emailConfirmHash = hashedEmailConfirmCode;
    jobCount--;
    insertUser();
  });

  function insertUser() {
    // Check if all that hashing is done...
    if (jobCount > 0) {
      return;
    }

    // Create the query
    let query = `INSERT INTO users (
      email, 
      first_name, 
      last_name, 
      phone, 
      password, 
      profile_picture, 
      area,
      email_confirm_hash,
      phone_confirm_hash,
      email_confirmed,
      phone_confirmed,
      active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, true)`;

    // Collect the values
    var values = [
      email,
      firstName,
      lastName,
      phone,
      password,
      profilePicture,
      area,
      emailConfirmHash,
      phoneConfirmHash
    ];

    // Query the db
    db
      .query(query, values)
      .then(dbRes => {
        if (dbRes.rowCount == 1) {
          sendConfirmCodePhone(phoneConfirmCode, phone);
          sendConfirmCodeEmail(emailConfirmCode, email);

          console.log("phoneConfirmCode", phoneConfirmCode);

          return res.json({
            status: "OK",
            message: "User signed up"
          });
        }

        // Eeeh. More than one is inserted? Or zero is inserted
        // without the databse driver returning an error?
        // This block will hopefully never get called
        return sendError(res, "Unknown database error");
      })
      .catch(err => {
        // There is a unique-constraint on the email column. This error is returned
        // if the email already exists
        if (err.code == "23505") {
          return sendError(res, "Email is already taken");
        }
        // Im not sure what to check for here. I cant figure out what would trigger this except for
        // hardcoded issues in the sql-statement or missing values
        return sendError(res, "Invalid database query");
      });
  }
});

/******** Get info about a single user ********/
router.get("/:userId", verifyToken, (req, res) => {
  // Checks if authorized user is the one that's being asked for. If it is, then send email and phone
  // if it's not, then don't include email and phone in query
  var conditionalColumns = "";
  if (req.params.userId == res.locals.authData.user.id) {
    var conditionalColumns = "email, phone, ";
  }

  var query = `SELECT user_id, first_name, last_name, ${conditionalColumns} profile_picture, area FROM users WHERE user_id = $1`;
  var values = [req.params.userId];

  db
    .query(query, values)
    .then(dbRes => {
      if (dbRes.rowCount < 1) {
        return res.json({
          status: "OK",
          message: "No user found"
        });
      }

      // Map the database to a user's object
      var user = {
        id: dbRes.rows[0].user_id,
        firstName: dbRes.rows[0].first_name,
        lastName: dbRes.rows[0].last_name,
        email: dbRes.rows[0].email || "Private",
        phone: dbRes.rows[0].phone || "Private",
        profilePicture: dbRes.rows[0].profilePicture,
        area: dbRes.rows[0].area
      };
      return res.json({
        status: "OK",
        user
      });
    })
    .catch(err => {
      return sendError(res, "Could not query the database");
    });
});

/******** Update info about a single user ********/
router.put("/:userId", verifyToken, parseForm, (req, res) => {
  /**
   * Re-confirm email and password upon edits of these
   *
   * Note:
   * ----
   * This function is extremely verbose and repeats itself a lot.
   * I chose readability over compact code and fancy techniques.
   */

  // Checks if the user is the authorized user
  if (req.params.userId != res.locals.authData.user.id) {
    return sendError(res, "You can only edit your own profile");
  }

  // Creates start of query and an empty  array for values
  var query = "UPDATE users SET ";
  var values = [];

  /**
   * This part generates the final SQL string.
   * It's rather verbose and i could have chosen for the user
   * to just submit everything everytime and update the entire user object
   * or check for differnces, but this way the user can submit
   * just the fields that have changes
   *
   * Also note that a lot of the complexity is around generating new
   * confirmation codes. But i figured that if i had the check at sign up
   * it wouldn't make any sense to allow users to freely change their
   * email and phone after signing up
   */
  if (req.fields.email) {
    // Add the new email to the user
    values.push(req.fields.email);
    query += "email = $" + values.length + ",";
    // Create a new confirmation code
    let confirmCode = generateConfirmCode(10);
    // Add a verification token to the database
    values.push(bcrypt.hashSync(confirmCode + process.env.VERIFICATION_SECRET, saltRounds));
    query += "email_confirm_hash = $" + values.length + ",";
    // Set the number to unverified
    query += "email_confirmed = false,";
    // Send the code to the new email number
    sendConfirmCodeEmail(confirmCode, req.fields.email);
  }
  if (req.fields.firstName) {
    values.push(req.fields.firstName);
    query += "first_name = $" + values.length + ",";
  }
  if (req.fields.lastName) {
    values.push(req.fields.lastName);
    query += "last_name = $" + values.length + ",";
  }
  if (req.fields.phone) {
    // Add the new phone to the user
    values.push(req.fields.phone);
    query += "phone = $" + values.length + ",";
    // Create a new confirmation code
    let confirmCode = generateConfirmCode(4);
    // Add a verification token to the database
    values.push(bcrypt.hashSync(confirmCode + process.env.VERIFICATION_SECRET, saltRounds));
    query += "phone_confirm_hash = $" + values.length + ",";
    // Set the number to unverified
    query += "phone_confirmed = false,";
    // Send the code to the new phone number
    sendConfirmCodePhone(confirmCode, req.fields.phone);
  }
  if (req.fields.password) {
    values.push(bcrypt.hashSync(req.fields.password + process.env.PASSWORD_SECRET, saltRounds));
    query += "password = $" + values.length + ",";
  }
  if (req.fields.profilePicture) {
    values.push(req.fields.profilePicture);
    query += "profile_picture = $" + values.length + ",";
  }
  if (req.fields.area) {
    values.push(req.fields.area);
    query += "area = $" + values.length + ",";
  }

  // Removes trailing comma from SQL query
  query = query.slice(0, -1);
  values.push(req.params.userId);

  // Add the where clause
  query += " WHERE user_id = $" + values.length;

  // If no values were passed (all if statements evaluated to false), return an error
  if (values.length === 0) {
    return sendError(res, "No values were passed");
  }

  // Do the actual query
  db
    .query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        message: "User updated"
      });
    })
    .catch(err => {
      if (err.code == "23505") {
        return sendError(res, "Your email can't be the same as before");
      }
      return sendError(res, "Could not write the changes to the db");
    });
});

/******** Delete a single user ********/
router.delete("/:userId", verifyToken, parseForm, (req, res) => {
  // Checks if the user is the authorized user
  if (req.params.userId != res.locals.authData.user.id) {
    return sendError(res, "You can only delete your own profile");
  }

  var query = "UPDATE users SET active = false WHERE user_id = $1";
  var values = [req.params.userId];
  db
    .query(query, values)
    .then(dbRes => {
      console.log(dbRes);

      return res.json({
        status: "OK",
        message: "User deleted"
      });
    })
    .catch(err => {
      return sendError(res, "User could not be deleted");
    });
});

module.exports = router;