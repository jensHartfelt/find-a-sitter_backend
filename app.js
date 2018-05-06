var express = require("express");
var app = express();

/******** Static files ********/
app.use(express.static(__dirname + "/public"));

/******** Controllers ********/
// Auth
AuthController = require(__dirname + "/controllers/auth");
app.use("/api/auth", AuthController);

// Users
usersController = require(__dirname + "/controllers/users");
app.use("/api/users", usersController);

// Sitters
sittersController = require(__dirname + "/controllers/sitters");
app.use("/api/sitters", sittersController);

// Children
childrenController = require(__dirname + "/controllers/children");
app.use("/api/children", childrenController);

// Appointments
appointmentsController = require(__dirname + "/controllers/appointments");
app.use("/api/appointments", appointmentsController);

// Reviews
reviewsController = require(__dirname + "/controllers/reviews");
app.use("/api/reviews", reviewsController);

// Images
imagesController = require(__dirname + "/controllers/images");
app.use("/api/images", imagesController);

module.exports = app;