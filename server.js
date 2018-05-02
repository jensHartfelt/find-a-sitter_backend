require("dotenv").config();
require("log-timestamp");

var app = require("./app");
var port = process.env.PORT || 8081;

var server = app.listen(port, () => {
  console.log("OK  server.js -> App started at port " + port);
});
