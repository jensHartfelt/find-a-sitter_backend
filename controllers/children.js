const express = require("express");
const router = express.Router();
const db = require("../db");

// Utilities
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const formatDateForPostgres = require("../utilities/formatDateForPostgres");

/******** Gets all children belonging to userId ********/
router.get("/", verifyToken, (req, res) => {
  var query = `
    SELECT 
      child_id as id, 
      first_name as "firstName",
      last_name as "lastName",
      profile_picture as "profilePicture",
      extract(epoch FROM birthdate) as birthdate
    FROM children
    WHERE user_id = $1 AND active = true
    ORDER BY birthdate`
  var values = [res.locals.authData.user.id];

  db.query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        children: dbRes.rows
      })
    })
    .catch(err => {
      return sendError(res, "Could not get your children")
    })
})

/******** Adds a new child to current userId ********/
router.post("/", verifyToken, parseForm, (req, res) => {
  // Get all the values
  let firstName = req.fields.firstName;
  let lastName = req.fields.lastName;
  let birthdate = formatDateForPostgres(req.fields.birthdate, "date");
  let profilePicture = req.fields.profilePicture;
  let userId = res.locals.authData.user.id;

  // Check if any required values are undefined
  if (
    typeof firstName == "undefined" ||
    typeof lastName == "undefined" ||
    typeof birthdate == "undefined" ||
    typeof profilePicture == "undefined" ||
    typeof userId == "undefined"
  ) {
    return sendError(res, "Not all fields are present");
  }

  var query = "INSERT INTO children (first_name, last_name, birthdate, profile_picture, user_id, active) VALUES ($1, $2, $3, $4, $5, true)"
  var values = [firstName, lastName, birthdate, profilePicture, userId]
  db.query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        message: "Child added to your profile"
      })
    }).catch(err => {
      return sendError(res, "Could not query the database")
    })
})

/******** Edit info about a child ********/
router.put("/:childId", verifyToken, parseForm, (req, res) => {
  var query = `SELECT u.user_id FROM children c JOIN users u on c.user_id = u.user_id WHERE c.child_id = $1`;
  var values = [req.params.childId]

  db.query(query, values)
    .then(dbRes => {
      if (dbRes.rows[0].user_id == res.locals.authData.user.id) {
        return continueToUpdateChild();
      }
      return sendError(res, "You are not authorized to edit this child");
    })
    .catch(err => {
      return sendError(res, "Could not query the database.");
    });

  function continueToUpdateChild() {
    var query = "UPDATE children SET ";
    var values = [];

    if (req.fields.firstName) {
      values.push(req.fields.firstName);
      query += "first_name = $" + values.length + ",";
    }
    if (req.fields.lastName) {
      values.push(req.fields.lastName);
      query += "last_name = $" + values.length + ",";
    }
    if (req.fields.birthdate) {
      values.push(formatDateForPostgres(req.fields.birthdate, "date"));
      query += "birthdate = $" + values.length + ",";
    }
    if (req.fields.profilePicture) {
      values.push(req.fields.profilePicture);
      query += "profile_picture = $" + values.length + ",";
    }

    if (values.length === 0) {
      return sendError(res, "No values were passed");
    }

    // Removes trailing comma from SQL query
    query = query.slice(0, -1);
    values.push(req.params.childId);

    // Add the where clause
    query += " WHERE child_id = $" + values.length;

    db.query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Child edited"
        });
      })
      .catch(err => {
        return sendError(res, "Could not query the database.");
      });
  }
})

/******** Deactivate a child ********/
router.delete("/:childId", verifyToken, (req, res) => {
  var query = `SELECT u.user_id FROM children c JOIN users u on c.user_id = u.user_id WHERE c.child_id = $1`;
  var values = [req.params.childId]

  db.query(query, values)
    .then(dbRes => {
      if (dbRes.rows[0].user_id == res.locals.authData.user.id) {
        return continueToDeactivateChild();
      }
      return sendError(res, "You are not authorized to edit this child");
    })
    .catch(err => {
      return sendError(res, "Could not query the database.");
    });

  function continueToDeactivateChild() {
    var query = "UPDATE children SET active = false WHERE child_id = $1"
    var values = [req.params.childId];
    db.query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Child deactivated"
        })
      })
      .catch(err => {
        return sendError(res, "Could not query the database")
      })
  }
})



module.exports = router;