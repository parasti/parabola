'use strict';

// IE 11 compatibility.
require('string.fromcodepoint');
require('typedarray-methods');

/*
 * Utility namespace.
 */
var misc = {};

/*
 * Wrap DataView to automate byte counting and endianness.
 */
misc.DataStream = function (buffer) {
  this.view = new DataView(buffer);
  this.position = 0;
};

misc.DataStream.prototype.getInt32 = function () {
  var value = this.view.getInt32(this.position, true);
  this.position += 4;
  return value;
};

misc.DataStream.prototype.getFloat32 = function () {
  var value = this.view.getFloat32(this.position, true);
  this.position += 4;
  return value;
};

misc.DataStream.prototype.getUint8Array = function (length) {
  // Single bytes are order independent, reuse buffer.
  var value = new Uint8Array(this.view.buffer, this.position, length);
  this.position += length;
  return value;
};

misc.DataStream.prototype.getFloat32Array = function (length) {
  // Float bytes are not, convert values to a new array.
  var value = new Float32Array(length);
  for (var i = 0; i < length; ++i)
    value[i] = this.getFloat32();
  return value;
};

misc.DataStream.prototype.getInt32Array = function (length) {
  var value = new Int32Array(length);
  for (var i = 0; i < length; ++i) {
    value[i] = this.getInt32();
  }
  return value;
};

/*
 * Parse UTF-8 bytes into an array of Unicode codepoints.
 */
misc.utf8ToCodePoints = function (byteArray) {
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
misc.getCString = function (byteArray, fromIndex) {
  fromIndex = fromIndex || 0;
  var toIndex = byteArray.indexOf(0, fromIndex);
  if (toIndex < 0)
    toIndex = byteArray.length;

  var stringBytes = byteArray.subarray(fromIndex, toIndex);

  return String.fromCodePoint.apply(null, misc.utf8ToCodePoints(stringBytes));
};

/*
 * Node.js export.
 */
module.exports = misc;