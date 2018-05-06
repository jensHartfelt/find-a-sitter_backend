const express = require("express");
const router = express.Router();
const db = require("../db");

const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");
const formatDateForPostgres = require("../utilities/formatDateForPostgres");


router.post("/", verifyToken, parseForm, (req, res) => {
  // Get values
  let startTime = formatDateForPostgres(req.fields.startTime, "timestamp");
  let endTime = formatDateForPostgres(req.fields.endTime, "timestamp");
  let childId = req.fields.childId;
  let sitterId = req.fields.sitterId;
  let comment = req.fields.comment; // Use this to send a message in a chat.

  // Check if all values are there
  if (
    typeof startTime === "undefined" ||
    typeof endTime === "undefined" ||
    typeof childId === "undefined" ||
    typeof sitterId === "undefined"
  ) {
    return sendError(res, "Not all fields are present")
  }

  // If sitterId and childId belongs to same user, reject appointment
  // You are now allowed to babysit your own children. This would make
  // it way to easy to cheat with reviews
  var sittersUserId;
  var childsUserId;
  var query = `
  SELECT 
    s.user_id AS "sittersUserId",
    c.user_id AS "childsUserId" 
  FROM sitters s, children c
  WHERE s.sitter_id = $1 AND c.child_id = $2`
  var values = [sitterId, childId]
  db.query(query, values)
    .then(dbRes => {
      if (dbRes.rows[0].sittersUserId == dbRes.rows[0].childsUserId) {
        return sendError(res, "You can't babysit your own children")
      }
      createAppointment()
    })
    .catch(err => {
      return sendError(res, "Can't query database")
    })

  // All values are present and child and sitter are not registered to
  // the same user
  function createAppointment() {
    var query = `INSERT INTO appointments (
      start_time,
      end_time,
      child_id,
      sitter_id,
      confirmed
    ) 
    VALUES (
      $1, $2, $3, $4, false
    )`
    var values = [startTime, endTime, childId, sitterId]
    db.query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Appointment created"
        })
      })
      .catch(err => {
        return sendError(res, "Could not query database")
      })
  }
})

router.get("/", verifyToken, parseForm, (req, res) => {
  /**
   * There is a lot going on here, so i'll just do a quick flow-explanation:
   * The steps (1,2,3) outline what is async and what is sync (everything in
   * one step happens at the same time)
   * 
   * 1) Find users sitterId (this might not be there) 
   *    Find a users children (childId's) - which might also not be there
   * 2) Look up all appointments where the users sitterId is listed as sitter
   *    -> Map the result to a readable json-structure
   *    Look up all appointments where the users children are listed as children
   *    -> Map the result to a readable json-structure
   * 3) Respond to client with found results (could be two empty arrays)
   * 
   */

  // Variables needed throughout this route
  var userId = res.locals.authData.user.id;
  var sitterId;
  var childrenIds = [];
  var babysittingAppointments = [];
  var childAppointments = [];
  var jobCount = 2;

  // Query that checks for a sitter id
  let querySitterId = "SELECT sitter_id FROM sitters WHERE user_id = $1"
  let valuesSitterId = [userId]
  db.query(querySitterId, valuesSitterId)
    .then(dbRes => {
      sitterId = dbRes.rows[0].sitter_id;
      getSittersAppointments();
    })
    .catch(err => {
      return sendError(res, "Could not query database")
    })

  function getSittersAppointments() {
    // If a sitter id is found, get all the appointments where current user is babysitting
    if (sitterId) {
      let query = `SELECT 
        a.appointment_id AS id,
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.confirmed,
        a.confirmed_at AS "confirmedAt",
        c.child_id as "childId",
        c.first_name as "childFirstName",
        c.last_name as "childLastName",
        c.birthdate as "childBirthDate",
        c.profile_picture as "childProfilePicture",
        u.user_id as "parentId",
        u.first_name AS "parentFirstName",
        u.last_name AS "parentLastName",
        u.profile_picture as "parentProfilePicture"
      FROM appointments a 
        NATURAL JOIN children c
        INNER JOIN users u ON (c.user_id = u.user_id)
      WHERE a.sitter_id = $1`
      let values = [sitterId]

      db.query(query, values)
        .then(dbRes => {
          // Maps the returned rows to a nicer json structure
          babysittingAppointments = dbRes.rows.map(row => ({
            id: row.id,
            startTime: row.startTime,
            endTime: row.endTime,
            confirmed: row.confirmed,
            reviewed: row.reviewed,
            child: {
              id: row.childId,
              firstName: row.childFirstName,
              lastName: row.childLastName,
              profilePicture: row.childProfilePicture
            },
            parent: {
              id: row.parentId,
              firstName: row.parentFirstName,
              lastName: row.parentLastName,
              profilePicture: row.parentProfilePicture
            }
          }))

          // Done mapping the appointments, update jobCount and try to respond to client
          jobCount--;
          return sendFinalResponse()
        })
        .catch(err => {
          return sendError(res, "Could not query database")
        })
    } else {
      // User is not a sitter, so dont waste time looking up anything in the db
      jobCount--
      return sendFinalResponse()
    }
  }

  // Query that checks for a children id
  let queryChildrenId = "SELECT child_id FROM children WHERE user_id = $1"
  let valuesChildrenId = [userId]
  db.query(queryChildrenId, valuesChildrenId)
    .then(dbRes => {
      childrenIds = dbRes.rows.map(row => (row.child_id))
      getChildrensAppointments();
    })
    .catch(err => {
      console.log(err)
      return sendError(res, "Could not query database")
    })

  function getChildrensAppointments() {
    if (childrenIds.length > 0) {
      let query = `
        SELECT 
          a.appointment_id AS id,
          a.start_time AS "startTime",
          a.end_time AS "endTime",
          a.confirmed,
          a.confirmed_at AS "confirmedAt",
          u.first_name AS "sitterFirstName",
          u.last_name AS "sitterLastName",
          s.sitter_id AS "sitterId",
          u.profile_picture AS "sitterProfilePicture"
        FROM appointments a 
          NATURAL JOIN sitters s
          INNER JOIN users u ON (s.user_id = u.user_id)
        WHERE `

      let values = []

      // String template the $1, $2, $3 onto the query and push the ids
      // to the values array
      childrenIds.forEach((childId, index) => {
        query += "a.child_id = $" + (index + 1) + " OR ";
        values.push(childId)
      })
      query = query.slice(0, -4) //Removes last " OR "

      // Run the query
      db.query(query, values)
        .then(dbRes => {
          childAppointments = dbRes.rows.map(row => ({
            startTime: row.startTime,
            endTime: row.endTime,
            confirmed: row.confirmed,
            reviewed: row.reviewed,
            sitter: {
              id: row.sitterId,
              firstName: row.sitterFirstName,
              lastName: row.sitterLastName,
              profilePicture: row.sitterProfilePicture
            }
          }))
          jobCount--;
          sendFinalResponse();
        })
        .catch(err => {
          console.log(err)
        })
    } else {
      jobCount--;
      sendFinalResponse()
    }
  }

  function sendFinalResponse() {
    // Check if all tasks are done
    if (jobCount > 0) {
      return
    }

    // Send response
    return res.json({
      status: "OK",
      childAppointments,
      babysittingAppointments
    })
  }
})

router.post("/confirm/:appointmentId", verifyToken, parseForm, (req, res) => {
  var query = `
    SELECT 
      a.appointment_id,
      a.confirmed
    FROM appointments a
      INNER JOIN sitters s ON (s.sitter_id = a.sitter_id)
      INNER JOIN users u ON (s.user_id = u.user_id)
    WHERE a.appointment_id = $1 AND u.user_id = $2`
  var values = [req.params.appointmentId, res.locals.authData.user.id]
  db.query(query, values)
    .then(dbRes => {
      if (dbRes.rowCount == 0) {
        return sendError(res, "No appointment found")
      }
      if (dbRes.rows[0].confirmed === true) {
        return sendError(res, "Appointment already confirmed")
      }
      confirmAppointment()
    })
    .catch(err => {
      return sendError(res, "Could not query database")
    })

  function confirmAppointment() {
    var query = `UPDATE appointments SET confirmed = true, confirmed_at = $1 WHERE appointment_id = $2`
    var values = [formatDateForPostgres(Date.now(), "timestamp"), req.params.appointmentId]
    db.query(query, values)
      .then(dbRes => {
        return res.json({
          status: "OK",
          message: "Appointment confirmed"
        })
      })
      .catch(err => {
        return sendError(res, "No appointment found")
      })
  }
})

module.exports = router;