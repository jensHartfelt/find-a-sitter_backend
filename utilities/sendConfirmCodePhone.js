const request = require("request");

module.exports = function(verificationCode, phone) {
  console.log("Sending sms to ", phone);
  var formData = {
    apiToken: process.env.SMS_API_TOKEN,
    mobile: phone,
    message: "You confirmation code is: " + verificationCode
  };
  // request.post(
  //   { url: "http://smses.io/api-send-sms.php", formData: formData },
  //   function optionalCallback(err, httpResponse, body) {
  //     if (err) {
  //       return console.log("SENDING MESSAGE FAILED:", err, body);
  //     } else {
  //       console.log("OK - message sent to " + phone, body);
  //     }
  //   }
  // );
};
