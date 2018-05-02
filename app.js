var express = require("express");
var app = express();

/******** CORS policy ********/
app.use(function(req, res, next) {
  // Allows all origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type,Authorization"
  );
  next();
});

// Users
// usersController = require(__dirname + "/controllers/usersController");
// app.use("/api/users", usersController);

// Posts
// postsController = require(__dirname + "/controllers/posts");
// app.use("/api/posts", postsController);

// Posts
// tagsController = require(__dirname + "/controllers/tags");
// app.use("/api/tags", tagsController);

// Auth
AuthController = require(__dirname + "/controllers/auth");
app.use("/api/auth", AuthController);

// Users
usersController = require(__dirname + "/controllers/users");
app.use("/api/users", usersController);

app.use(express.static(__dirname + "/public"));

module.exports = app;
