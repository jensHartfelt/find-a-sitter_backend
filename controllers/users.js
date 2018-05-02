const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const request = require("request");
const nodemailer = require("nodemailer");
const saltRounds = 10;
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const generateCode = require("../utilities/generateCode");

// var transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: "sjellesto@gmail.com",
//     pass: "gyrocopter"
//   }
// });

// transporter.verify((err, succes) => {
//   if (err) {
//     return console.log("Unable to connect to mail server", err);
//   }
//   console.log("Mail server ready");
// });

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
  var jobCount = 3;

  // Hash password
  bcrypt
    .hash(password + process.env.PASSWORD_SECRET, saltRounds)
    .then(hashedPassword => {
      password = hashedPassword;
      jobCount--;
      insertUser();
    });

  // Create hash value for checking if the sms verification is valid
  bcrypt
    .hash(phoneConfirmCode + process.env.VERIFICATION_SECRET, saltRounds)
    .then(hashedPhoneConfirmCode => {
      phoneConfirmHash = hashedPhoneConfirmCode;
      jobCount--;
      insertUser();
      sendVerificationCodeToPhone();
    });

  // Create hash value for mail-system
  bcrypt
    .hash(emailConfirmCode + process.env.VERIFICATION_SECRET, saltRounds)
    .then(hashedEmailConfirmCode => {
      emailConfirmHash = hashedEmailConfirmCode;
      jobCount--;
      insertUser();
      sendVerificationCodeToEmail();
    });

  function insertUser() {
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
    console.log("Send to phone");
    var formData = {
      apiToken: "$2y$10$q7taqR1/vh8Pytcxmd/LpudesUzf1AnNV/wec2DOuCcycuNwDTSSW",
      mobile: phone,
      message: "You confirmation code is: XXXX"
    };
    request.post(
      { url: "http://smses.io/api-send-sms.php", formData: formData },
      function optionalCallback(err, httpResponse, body) {
        if (err) {
          return console.log("SENDING MESSAGE FAILED:", err, body);
        } else {
          console.log("OK - message sent to " + phone, body);
        }
      }
    );

    // var formData = {
    //   apiToken: "$2y$10$q7taqR1/vh8Pytcxmd/LpudesUzf1AnNV/wec2DOuCcycuNwDTSSW",
    //   mobile: phone,
    //   message: "You confirmation code is: " + phoneConfirmCode
    // };
    // request.post(
    //   {
    //     url: "http://smses.io/api-send-sms.php",
    //     formData
    //   },
    //   (err, res, body) => {
    //     if (err) {
    //       return console.log("SENDING MESSAGE FAILED:", err);
    //     } else {
    //       console.log("OK - message sent to " + phone, res, body);
    //     }
    //   }
    // );
  }

  function sendVerificationCodeToEmail() {
    console.log("Send to email");
  }
});

/******** Get info about a single user ********/
router.get("/:userId", verifyToken, (req, res) => {});

/******** Update info about a single user ********/
router.put("/:userId", verifyToken, parseForm, (req, res) => {});

/******** Delete a single user ********/
router.delete("/:userId", verifyToken, parseForm, (req, res) => {});

module.exports = router;
