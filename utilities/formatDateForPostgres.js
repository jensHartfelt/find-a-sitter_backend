module.exports = function(date, type = "timestamp") {
  /**
   * Credits to: https://gist.github.com/jczaplew/f055788bf851d0840f50
   */

  function zeroPad(d) {
    return ("0" + d).slice(-2);
  }

  var parsed = new Date(date);

  if (type == "date") {
    return [parsed.getUTCFullYear(), zeroPad(parsed.getMonth() + 1), zeroPad(parsed.getDate())].join(" ");
  }
  if (type == "timestamp") {
    return (timestamp =
      parsed.getUTCFullYear() +
      "-" +
      zeroPad(parsed.getMonth() + 1) +
      "-" +
      zeroPad(parsed.getDate()) +
      " " +
      zeroPad(parsed.getHours()) +
      ":" +
      zeroPad(parsed.getMinutes()) +
      ":" +
      zeroPad(parsed.getSeconds()));
  }
};
