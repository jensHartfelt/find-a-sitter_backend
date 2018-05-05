const express = require("express");
const router = express.Router();
const db = require("../db");

// Utilities
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const formatDateForPostgres = require("../utilities/formatDateForPostgres");

/******** Get public list of sitters ********/
router.get("/", (req, res) => {
  /**
   * Query params:
   * limit  <int>  Limits the amount of results
   * offset <int>  Controls the offset (useful for pagination)
   *
   * Selects all sitters with the following requirements:
   * sitter has to be active
   * user has to be active
   * phone has to be confirmed
   * email has to be confirmed
   */

  // instead of doing the limit = limit || some-default-value
  // im doing this, as this is one of those cases where a falsy
  // value would be accepted offset=0 or limit=0 (although limit 0
  // would be stupid)
  if (typeof req.params.limit === "undefined") {
    var limit = 10;
  } else {
    var limit = req.params.limit;
  }
  if (typeof req.params.offset === "undefined") {
    var offset = 0;
  } else {
    var offset = req.params.limit;
  }

  var query = `
  SELECT 
    sitter_id as id, 
    first_name as "firstName",
    last_name as "lastName",
    email,
    phone,
    profile_picture as "profilePicture",
    area,
    about,
    extract(epoch from registered_at) as "registeredAt",
    salary,
    preferred_working_time as "preferredWorkingTime",
    years_experience as "yearsOfExperience"
  FROM users u NATURAL JOIN sitters s
  WHERE u.active = true AND s.active = true AND u.email_confirmed = true AND u.phone_confirmed = true
  LIMIT $1 OFFSET $2`;

  var values = [limit, offset];

  db
    .query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        sitters: dbRes.rows
      });
    })
    .catch(err => {
      console.log(err);
      return sendError(res, "Could not get sitters");
    });
});

/******** Sign logged in user up as sitter ********/
router.post("/register", verifyToken, parseForm, (req, res) => {
  try {
    // Get all the needed values
    var about = req.fields.about;
    var preferredWorkingTime = req.fields.preferredWorkingTime;
    var salary = req.fields.salary;
    var birthdate = req.fields.birthdate;
    var yearsExperience = req.fields.yearsExperience;
    var user = res.locals.authData.user;
  } catch (err) {
    sendError(res, "Error reading the form-data");
  }

  // Check if any required values are undefined
  if (
    typeof about == "undefined" ||
    typeof preferredWorkingTime == "undefined" ||
    typeof salary == "undefined" ||
    typeof birthdate == "undefined"
  ) {
    return sendError(res, "Not all fields are present");
  }

  var query = `INSERT INTO sitters (
    about, 
    salary, 
    birthdate,
    preferred_working_time,
    years_experience,
    registered_at, 
    user_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
  var values = [
    about,
    salary,
    formatDateForPostgres(birthdate, "date"),
    preferredWorkingTime,
    yearsExperience,
    formatDateForPostgres(Date.now(), "timestamp"),
    user.id
  ];

  db
    .query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        message: "Sitter registered"
      });
    })
    .catch(err => {
      if (err.code == 23505) {
        return sendError(res, "You're already registered as sitter. Can't register again");
      }
      return sendError(res, "Could not query the database.");
    });
});

/******** Edits a sitter ********/
router.put("/:sitterId", verifyToken, parseForm, (req, res) => {
  // Check if this sitters profile belongs to the authorized user
  db
    .query("SELECT u.user_id FROM users u NATURAL JOIN sitters s WHERE sitter_id = $1", [req.params.sitterId])
    .then(dbRes => {
      if (dbRes.rows[0].user_id == res.locals.authData.user.id) {
        return continueToUpdateSitter();
      }
      return sendError(res, "You are not authorized to edit this profile");
    })
    .catch(err => {
      return sendError(res, "Could not query the database.");
    });

  function continueToUpdateSitter() {
    var query = "UPDATE sitters s SET ";
    var values = [];

    if (req.fields.about) {
      values.push(req.fields.about);
      query += "about = $" + values.length + ",";
    }
    if (req.fields.preferredWorkingTime) {
      values.push(req.fields.preferredWorkingTime);
      query += "preferred_working_time = $" + values.length + ",";
    }
    if (req.fields.salary) {
      values.push(req.fields.salary);
      query += "salary = $" + values.length + ",";
    }
    if (req.fields.birthdate) {
      values.push(formatDateForPostgres(req.fields.birthdate, "date"));
      query += "birthdate = $" + values.length + ",";
    }
    if (req.fields.yearsExperience) {
      values.push(req.fields.yearsExperience);
      query += "years_experience = $" + values.length + ",";
    }

    // Removes trailing comma from SQL query
    query = query.slice(0, -1);
    values.push(req.params.sitterId);

    // Add the where clause
    query += " WHERE sitter_id = $" + values.length;

    // If no values were passed (all if statements evaluated to false), return an error
    if (values.length === 0) {
      return sendError(res, "No values were passed");
    }

    db
      .query(query, values)
      .then(dbRes => {
        console.log(dbRes);
        return res.json({
          status: "OK",
          message: "Sitter edited"
        });
      })
      .catch(err => {
        console.log(err);
        return sendError(res, "Could not query the database.");
      });
  }
});

/******** Deactivates a sitter ********/
router.delete("/:sitterId", verifyToken, (req, res) => {
  // Check if this sitters profile belongs to the authorized user
  db
    .query("SELECT u.user_id, s.active FROM users u NATURAL JOIN sitters s WHERE sitter_id = $1", [req.params.sitterId])
    .then(dbRes => {
      if (dbRes.rows.length && dbRes.rows[0].user_id == res.locals.authData.user.id) {
        return continueToDeactivateSitter();
      }
      return sendError(res, "You are not authorized to edit this profile");
    })
    .catch(err => {
      console.log(err);
      return sendError(res, "Could not query the database.");
    });

  function continueToDeactivateSitter() {
    var query = "UPDATE sitters SET active = false WHERE sitter_id = $1";
    var values = [req.params.sitterId];

    db
      .query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Sitter deactivated."
        });
      })
      .catch(err => {
        return sendError(res, "Could not query the database");
      });
  }
});

module.exports = router;
