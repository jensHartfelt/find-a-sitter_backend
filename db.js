const { Pool, Client } = require("pg");

const db = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASS,
  port: 5432
});
db
  .connect()
  .then(() => {
    console.log("OK  db.js -> Connected to db");
  })
  .catch(err => {
    console.log("ERR db.js -> Could not connect to db. Shutting down.", err);
    process.exit();
  });

module.exports = db;
