module.exports = function(codeLength) {
  let code = "";
  let loopLength = codeLength || 4;
  var possibleValues =
    "abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVXYZ0123456789";
  for (var i = 0; i < loopLength; i++) {
    code += possibleValues[Math.floor(Math.random() * possibleValues.length)];
  }
  return code;
};
