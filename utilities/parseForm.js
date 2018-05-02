var formidable = require("formidable");

module.exports = function parseForm(req, res, next) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    if (err) {
      return res.json({ status: "ERROR", message: "Error parsing form" });
    }

    req.fields = fields;
    req.files = files;
    next();
  });
};
