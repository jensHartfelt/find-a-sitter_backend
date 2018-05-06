module.exports = function (rating) {
  /**
   * Limits rating from 0 to 5.
   * I will also make client side validation but if
   * someone spoofs the api and makes a rating of
   * ie. 100000 the average rating will be way to high
   * 
   * Everything over 5 is returned as 5
   * Everything under 0 is returned as 0
   */
  if (rating > 5) {
    return 5;
  }
  if (rating < 0) {
    return 0;
  }
  return rating;
}