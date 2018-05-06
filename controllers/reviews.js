const express = require("express");
const router = express.Router();
const db = require("../db");

// Utilities
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const limitRating = require("../utilities/limitRating")
const formatDateForPostgres = require("../utilities/formatDateForPostgres");

/******** Get all reviews of a sitter ********/
router.get("/:sitterId", (req, res) => {
  var query = `
  SELECT 
    r.review_id AS id,
    r.rating,
    r.content,
    extract(epoch FROM r.created_at) AS "createdAt",
    u.user_id AS "userId",
    u.first_name AS "userFirstName",
    u.last_name AS "userLastName",
    u.profile_picture AS "userProfilePicture"
  FROM reviews r
    INNER JOIN users u ON (r.user_id = u.user_id) 
  WHERE sitter_id = $1`
  var values = [req.params.sitterId]
  db.query(query, values)
    .then(dbRes => {
      return res.json({
        status: "OK",
        reviews: dbRes.rows.map(row => ({
          id: row.id,
          rating: row.rating,
          content: row.content,
          createdAt: row.createdAt,
          author: {
            id: row.userId,
            firstName: row.userFirstName,
            lastName: row.userLastName,
            profilePicture: row.userProfilePicture
          }
        }))
      })
    })
    .catch(err => {
      console.log(err)
      return sendError(res, "Could not query database")
    })
})

/******** Add review of a sitter ********/
router.post("/:sitterId", verifyToken, parseForm, (req, res) => {

  var jobCount = 2;

  // Business rule: A user can only review a sitter once and a user cannot review self
  // Both of these functions will return error responses if certain conditions are met
  // It will only get to the createReview() if all tests passes
  checkIfSitterIsUser()
  checkIfUserAlreadyReviewedSitter()

  function checkIfSitterIsUser() {
    let query = `
    SELECT 
      u.user_id 
    FROM users u 
      NATURAL JOIN sitters s 
    WHERE sitter_id = $1`;
    let values = [req.params.sitterId]

    db.query(query, values)
      .then(dbRes => {
        if (dbRes.rows[0].user_id == res.locals.authData.user.id) {
          return sendError(res, "You cannot review your self");
        }
        jobCount--;
        return createReview();
      })
      .catch(err => {
        return sendError(res, "Could not query the database.");
      });
  }

  function checkIfUserAlreadyReviewedSitter() {
    var query = `SELECT review_id FROM reviews WHERE sitter_id = $1 AND user_id = $2`
    var values = [req.params.sitterId, res.locals.authData.user.id]

    db.query(query, values)
      .then(dbRes => {
        if (dbRes.rowCount == 0) {
          jobCount--;
          return createReview();
        }
        return sendError(res, "You have already reviewed this babysitter");
      })
      .catch(err => {
        return sendError(res, "Could not query the database.");
      })
  }

  function createReview() {
    if (jobCount > 0) return;

    var rating = limitRating(req.fields.rating);
    var content = req.fields.content;
    var createdAt = formatDateForPostgres(Date.now(), "timestamp");
    var userId = res.locals.authData.user.id;
    var sitterId = req.params.sitterId;

    var query = `INSERT INTO reviews (rating, content, created_at, user_id, sitter_id) VALUES ($1, $2, $3, $4, $5)`
    var values = [rating, content, createdAt, userId, sitterId];
    db.query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Review added"
        })
      })
      .catch(err => {
        return sendError(res, "Could not query database")
      })
  }
})

module.exports = router;