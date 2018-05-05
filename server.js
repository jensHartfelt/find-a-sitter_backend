require("dotenv").config(); // Loads .env file
require("log-timestamp"); // adds timestamps to console.logs -> Really useful when going through server logs!

var app = require("./app");
var port = process.env.PORT || 8081;

/******** CORS policy ********/
app.use(function(req, res, next) {
  // Allows all origins <- would be extra secure to limit it to findasitter.tk and localhost if
  // server is running in dev-mode
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
  next();
});

/******** Start app ********/
var server = app.listen(port, () => {
  console.log("OK  server.js -> App started at port " + port);
});
