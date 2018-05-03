const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../db");
const bcrypt = require("bcryptjs");
const request = require("request");
const saltRounds = 10;
const mailService = require("../utilities/mailService");
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const generateCode = require("../utilities/generateCode");

/******** Sign up ********/
router.post("/", parseForm, (req, res) => {
  // Get all the needed values
  try {
    var email = req.fields.email;
    var firstName = req.fields.firstName;
    var lastName = req.fields.lastName;
    var phone = req.fields.phone;
    var password = req.fields.password;
    var profilePicture = req.fields.profilePicture;
    var area = req.fields.area;
    var phoneConfirmCode = generateCode();
    var phoneConfirmHash = "";
    var emailConfirmCode = generateCode(12);
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
  } catch (err) {
    return sendError(res, "Not all fields are present");
  }

  // Describes the amount af async actions needed to complete before inserting a user
  // (it's all hashing functions so it should practically be instant)
  var jobCount = 3;

  // Hash password
  bcrypt
    .hash(password + process.env.PASSWORD_SECRET, saltRounds)
    .then(hashedPassword => {
      password = hashedPassword;
      jobCount--;
      insertUser();
    });

  // Hash phone confirmation
  bcrypt
    .hash(phoneConfirmCode + process.env.VERIFICATION_SECRET, saltRounds)
    .then(hashedPhoneConfirmCode => {
      phoneConfirmHash = hashedPhoneConfirmCode;
      jobCount--;
      insertUser();
    });

  // Hash email confirmation
  bcrypt
    .hash(emailConfirmCode + process.env.VERIFICATION_SECRET, saltRounds)
    .then(hashedEmailConfirmCode => {
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
      phone_confirmed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)`;

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
          sendVerificationCodeToPhone();
          sendVerificationCodeToEmail();

          return res.json({
            status: "OK",
            message: "User signed up"
          });
          return sendError(res, "Unknown database error");
        }
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

  function sendVerificationCodeToPhone() {
    var formData = {
      apiToken: process.env.SMS_API_TOKEN,
      mobile: phone,
      message: "You confirmation code is: XXXX"
    };
    // request.post(
    //   { url: "http://smses.io/api-send-sms.php", formData: formData },
    //   function optionalCallback(err, httpResponse, body) {
    //     if (err) {
    //       return console.log("SENDING MESSAGE FAILED:", err, body);
    //     } else {
    //       console.log("OK - message sent to " + phone, body);
    //     }
    //   }
    // );
  }

  function sendVerificationCodeToEmail() {
    fs.readFile("./mail-templates/confirm-code.html", "utf8", (err, file) => {
      if (err) {
        return console.log(
          "ERR users.js -> Confirmation-email-file not read",
          err
        );
      }
      file = file.replace("{{confirmationCode}}", emailConfirmCode);
      mailService.sendMail(
        {
          from: "noreply@findasitter.tk",
          to: "sjellest@gmail.com", // REMEMBER TO CHANGE THIS TO ACTUAL EMAIL!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
          subject: "Your confirmation code",
          html: file
        },
        (err, result) => {
          if (err) {
            return console.log(
              "ERR users.js -> Confirmation email not send",
              err
            );
          }
        }
      );
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
router.put("/:userId", verifyToken, parseForm, (req, res) => {});

/******** Delete a single user ********/
router.delete("/:userId", verifyToken, parseForm, (req, res) => {});

module.exports = router;
