'use strict';

/*
 * Utility namespace.
 */
var util = {};

/*
 * Wrap DataView to automate byte counting and endianness.
 */
util.DataStream = function (buffer) {
  this.view = new DataView(buffer);
  this.position = 0;
};

util.DataStream.prototype.getInt32 = function () {
  var value = this.view.getInt32(this.position, true);
  this.position += 4;
  return value;
};

util.DataStream.prototype.getFloat32 = function () {
  var value = this.view.getFloat32(this.position, true);
  this.position += 4;
  return value;
};

util.DataStream.prototype.getUint8Array = function (length) {
  // Single bytes are order independent, reuse buffer.
  var value = new Uint8Array(this.view.buffer, this.position, length);
  this.position += length;
  return value;
};

util.DataStream.prototype.getFloat32Array = function (length) {
  // Float bytes are not, convert values to a new array.
  var value = new Float32Array(length);
  for (var i = 0; i < length; ++i)
    value[i] = this.getFloat32();
  return value;
};

util.DataStream.prototype.getInt32Array = function (length) {
  var value = new Int32Array(length);
  for (var i = 0; i < length; ++i) {
    value[i] = this.getInt32();
  }
  return value;
};

/*
 * Parse UTF-8 bytes into an array of Unicode codepoints.
 */
util.utf8ToCodePoints = function (byteArray) {
  function addUtf8Byte(codePoints, val) {
    if ((val & 0x80) === 0) { // ASCII (0xxx xxxx)
      codePoints.push(val);
    } else if ((val & 0xe0) === 0xc0) { // two-byte start (110x xxxx)
      codePoints.push(val & 0x1f);
    } else if ((val & 0xf0) === 0xe0) { // three-byte start (1110 xxxx)
      codePoints.push(val & 0x0f);
    } else if ((val & 0xf8) === 0xf0) { // four-byte start (1111 0xxx)
      codePoints.push(val & 0x0e);
    } else if ((val & 0xc0) === 0x80) { // multi-byte continuation (10xx xxxx)
      // TODO this doesn't check whether partial is actually partial.
      var partial = codePoints.pop();
      codePoints.push((partial << 6) | (val & 0x3f));
    }
    return codePoints;
  }

  return byteArray.reduce(addUtf8Byte, []);
};

/*
 * Get a null-terminated string from a Uint8Array.
 */
util.getCString = function (byteArray, fromIndex) {
  fromIndex = fromIndex || 0;
  var toIndex = byteArray.indexOf(0, fromIndex);
  if (toIndex < 0)
    toIndex = byteArray.length;

  var stringBytes = byteArray.subarray(fromIndex, toIndex);

  return String.fromCodePoint.apply(null, util.utf8ToCodePoints(stringBytes));
};

/*
 * Calculate a perspective matrix.
 */
util.calcPersp = function(M, w, h) {
  var a = w / h;
  var fov = 50;
  var n = 0.1;
  var f = 512.0;

  var r = fov / 2 * Math.PI / 180;
  var s = Math.sin(r);
  var c = Math.cos(r) / s;

  M[0] = c / a;
  M[1] = 0;
  M[2] = 0;
  M[3] = 0;
  M[4] = 0;
  M[5] = c;
  M[6] = 0;
  M[7] = 0;
  M[8] = 0;
  M[9] = 0;
  M[10] = -(f + n) / (f - n);
  M[11] = -1.0;
  M[12] = 0;
  M[13] = 0;
  M[14] = -2.0 * n * f / (f - n);
  M[15] = 0;

  return M;
};

/*
 * Node.js export.
 */
module.exports = util;