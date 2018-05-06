const express = require("express");
const router = express.Router();
const db = require("../db");
const fs = require("fs");
const sharp = require("sharp")
const uniqid = require("uniqid");

// Utilities
const verifyToken = require("../utilities/verifyToken");
const parseForm = require("../utilities/parseForm");
const sendError = require("../utilities/sendError");

/******** Add images ********/
router.post("/:type", verifyToken, parseForm, (req, res) => {

  /**
   * This isn't used right now, but i figured that i might need it later
   */
  req.params.type = req.params.type || "profile-picture"

  var filename = res.locals.authData.user.id + "-" + uniqid();
  var jobCount = 4;

  // Create mini image
  sharp(req.files.file.path)
    .jpeg()
    .resize(28, 28)
    .toFile(process.cwd() + `/public/images/${filename}-small.jpg`)
    .then(resizeDone)
    .catch(err => {
      return sendError(res, "Could not add the image")
    })

  // Create medium image
  sharp(req.files.file.path)
    .jpeg()
    .resize(58, 58)
    .toFile(process.cwd() + `/public/images/${filename}-medium.jpg`)
    .then(resizeDone)
    .catch(err => {
      return sendError(res, "Could not add the image")
    })

  // Create "large" image
  sharp(req.files.file.path)
    .jpeg()
    .resize(92, 92)
    .toFile(process.cwd() + `/public/images/${filename}-large.jpg`)
    .then(resizeDone)
    .catch(err => {
      return sendError(res, "Could not add the image")
    })

  // Create standard image
  sharp(req.files.file.path)
    .jpeg()
    .resize(256, 256)
    .toFile(process.cwd() + `/public/images/${filename}.jpg`)
    .then(resizeDone)
    .catch(err => {
      return sendError(res, "Could not add the image")
    })

  function resizeDone() {
    jobCount--
    if (jobCount === 0) {
      return res.json({
        status: "OK",
        images: {
          small: `${filename}-small.jpg`,
          medium: `${filename}-medium.jpg`,
          large: `${filename}-large.jpg`,
          standard: `${filename}.jpg`
        }
      })
    }
  }

})

module.exports = router;