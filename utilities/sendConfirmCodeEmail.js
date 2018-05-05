const fs = require("fs");
const mailService = require("./mailService");

module.exports = function(verificationCode, email) {
  console.log("Sending mail to ", email);
  fs.readFile("./mail-templates/confirm-code.html", "utf8", (err, file) => {
    if (err) {
      return console.log("ERR sendConfirmCodeEmail.js -> Confirmation-email-file not read", err);
    }
    file = file.replace("{{confirmationCode}}", verificationCode);
    mailService.sendMail(
      {
        from: "noreply@findasitter.tk",
        to: "sjellest@gmail.com", // email, // REMEMBER TO CHANGE THIS TO ACTUAL EMAIL!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        subject: "Your confirmation code",
        html: file
      },
      (err, result) => {
        if (err) {
          return console.log("ERR sendConfirmCodeEmail.js -> Confirmation email not send", err);
        }
      }
    );
  });
};
