const nodemailer = require("nodemailer");

var transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

transporter.verify((err, succes) => {
  if (err) {
    return console.log("ERR mailServive.js -> Couldn't connect to mail server");
  }
  console.log("OK  mailServive.js -> Connected to mail server");
});

module.exports = transporter;
