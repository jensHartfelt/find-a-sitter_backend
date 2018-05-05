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

module.exports = app;
