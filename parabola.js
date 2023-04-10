(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (ArrayBuffer.isView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (ArrayBuffer.isView(buf)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":7}],3:[function(require,module,exports){
(function (Buffer){
var Cursor = function(buffer)
{
	if (!(this instanceof Cursor))
	{
		return new Cursor(buffer);
	}

	if (!(buffer instanceof Buffer))
	{
		buffer = new Buffer(buffer);
	}

	this._setBuffer(buffer);
	this.rewind();
};

Cursor.prototype._setBuffer = function(buffer)
{
	this._buffer = buffer;
	this.length = buffer.length;
};

Cursor.prototype.buffer = function()
{
	return this._buffer;
};

Cursor.prototype.tap = function(cb)
{
	cb(this);
	return this;
};

Cursor.prototype.clone = function(newIndex)
{
	var c = new this.constructor(this.buffer());
	c.seek(arguments.length === 0 ? this.tell() : newIndex);

	return c;
};

Cursor.prototype.tell = function()
{
	return this._index;
};

Cursor.prototype.seek = function(op, index)
{
	if (arguments.length == 1)
	{
		index = op;
		op = '=';
	}

	if (op == '+')
	{
		this._index += index;
	}
	else if (op == '-')
	{
		this._index -= index;
	}
	else
	{
		this._index = index;
	}

	return this;
};

Cursor.prototype.rewind = function()
{
	return this.seek(0);
};

Cursor.prototype.eof = function()
{
	return this.tell() == this.buffer().length;
};

Cursor.prototype.write = function(string, length, encoding)
{
	return this.seek('+', this.buffer().write(string, this.tell(), length, encoding));
};

Cursor.prototype.fill = function(value, length)
{
	if (arguments.length == 1)
	{
		length = this.buffer().length - this.tell();
	}
	
	this.buffer().fill(value, this.tell(), this.tell() + length);
	this.seek('+', length);

	return this;
};

Cursor.prototype.slice = function(length)
{
	if (arguments.length === 0)
	{
		length = this.length - this.tell();
	}

	var c = new this.constructor(this.buffer().slice(this.tell(), this.tell() + length));
	this.seek('+', length);

	return c;
};

Cursor.prototype.copyFrom = function(source)
{
	var buf = source instanceof Buffer ? source: source.buffer();
	buf.copy(this.buffer(), this.tell(), 0, buf.length);
	this.seek('+', buf.length);

	return this;
};

Cursor.prototype.concat = function(list)
{
	for (var i in list)
	{
		if (list[i] instanceof Cursor)
		{
			list[i] = list[i].buffer();
		}
	}

	list.unshift(this.buffer());

	var b = Buffer.concat(list);
	this._setBuffer(b);

	return this;
};

Cursor.prototype.toString = function(encoding, length)
{
	if (arguments.length === 0)
	{
		encoding = 'utf8';
		length = this.buffer().length - this.tell();
	}
	else if (arguments.length === 1)
	{
		length = this.buffer().length - this.tell();
	}

	var val = this.buffer().toString(encoding, this.tell(), this.tell() + length);
	this.seek('+', length);

	return val;
};

[
	[1, ['readInt8', 'readUInt8']],
	[2, ['readInt16BE', 'readInt16LE', 'readUInt16BE', 'readUInt16LE']],
	[4, ['readInt32BE', 'readInt32LE', 'readUInt32BE', 'readUInt32LE', 'readFloatBE', 'readFloatLE']],
	[8, ['readDoubleBE', 'readDoubleLE']]
].forEach(function(arr)
{
	arr[1].forEach(function(method)
	{
		Cursor.prototype[method] = function()
		{
			var val = this.buffer()[method](this.tell());
			this.seek('+', arr[0]);

			return val;
		};
	});
});

[
	[1, ['writeInt8', 'writeUInt8']],
	[2, ['writeInt16BE', 'writeInt16LE', 'writeUInt16BE', 'writeUInt16LE']],
	[4, ['writeInt32BE', 'writeInt32LE', 'writeUInt32BE', 'writeUInt32LE', 'writeFloatBE', 'writeFloatLE']],
	[8, ['writeDoubleBE', 'writeDoubleLE']]
].forEach(function(arr)
{
	arr[1].forEach(function(method)
	{
		Cursor.prototype[method] = function(val)
		{
			val = this.buffer()[method](val, this.tell());
			this.seek('+', arr[0]);

			return this;
		};
	});
});

//basic extend functionality to facilitate
//writing your own cursor while still providing
//access to low level r/w functionality
Cursor.extend = function(C, proto)
{
	var parent = this;

	if (arguments.length === 1)
	{
		proto = C;
		C = null;
	}

	proto = proto || {};

	C = C || function ctor(buffer)
	{
		if (!(this instanceof C))
		{
			return new C(buffer);
		}

		parent.call(this, buffer);
	};

	require('util').inherits(C, parent);

	C.extend = parent.extend;
	C.define = parent.define;

	for (var i in proto)
	{
		C.define(i, proto[i]);
	}

	return C;
};

Cursor.define = function(name, fn)
{
	var proto = this.prototype[name];

	this.prototype[name] = proto && function()
	{
		this.__super = proto;
		return fn.apply(this, arguments);
	} || fn;
};

module.exports = Cursor;

}).call(this,require("buffer").Buffer)
},{"buffer":2,"util":21}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],5:[function(require,module,exports){
/*!
@fileoverview gl-matrix - High performance matrix and vector operations
@author Brandon Jones
@author Colin MacKenzie IV
@version 2.7.0

Copyright (c) 2015-2018, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
!function(t,n){if("object"==typeof exports&&"object"==typeof module)module.exports=n();else if("function"==typeof define&&define.amd)define([],n);else{var r=n();for(var a in r)("object"==typeof exports?exports:t)[a]=r[a]}}("undefined"!=typeof self?self:this,function(){return function(t){var n={};function r(a){if(n[a])return n[a].exports;var e=n[a]={i:a,l:!1,exports:{}};return t[a].call(e.exports,e,e.exports,r),e.l=!0,e.exports}return r.m=t,r.c=n,r.d=function(t,n,a){r.o(t,n)||Object.defineProperty(t,n,{enumerable:!0,get:a})},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.t=function(t,n){if(1&n&&(t=r(t)),8&n)return t;if(4&n&&"object"==typeof t&&t&&t.__esModule)return t;var a=Object.create(null);if(r.r(a),Object.defineProperty(a,"default",{enumerable:!0,value:t}),2&n&&"string"!=typeof t)for(var e in t)r.d(a,e,function(n){return t[n]}.bind(null,e));return a},r.n=function(t){var n=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(n,"a",n),n},r.o=function(t,n){return Object.prototype.hasOwnProperty.call(t,n)},r.p="",r(r.s=10)}([function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.setMatrixArrayType=function(t){n.ARRAY_TYPE=t},n.toRadian=function(t){return t*e},n.equals=function(t,n){return Math.abs(t-n)<=a*Math.max(1,Math.abs(t),Math.abs(n))};var a=n.EPSILON=1e-6;n.ARRAY_TYPE="undefined"!=typeof Float32Array?Float32Array:Array,n.RANDOM=Math.random;var e=Math.PI/180},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.forEach=n.sqrLen=n.len=n.sqrDist=n.dist=n.div=n.mul=n.sub=void 0,n.create=e,n.clone=function(t){var n=new a.ARRAY_TYPE(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n},n.fromValues=function(t,n,r,e){var u=new a.ARRAY_TYPE(4);return u[0]=t,u[1]=n,u[2]=r,u[3]=e,u},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t},n.set=function(t,n,r,a,e){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t},n.subtract=u,n.multiply=o,n.divide=i,n.ceil=function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t[3]=Math.ceil(n[3]),t},n.floor=function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t[3]=Math.floor(n[3]),t},n.min=function(t,n,r){return t[0]=Math.min(n[0],r[0]),t[1]=Math.min(n[1],r[1]),t[2]=Math.min(n[2],r[2]),t[3]=Math.min(n[3],r[3]),t},n.max=function(t,n,r){return t[0]=Math.max(n[0],r[0]),t[1]=Math.max(n[1],r[1]),t[2]=Math.max(n[2],r[2]),t[3]=Math.max(n[3],r[3]),t},n.round=function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t[3]=Math.round(n[3]),t},n.scale=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t},n.scaleAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t[3]=n[3]+r[3]*a,t},n.distance=s,n.squaredDistance=c,n.length=f,n.squaredLength=M,n.negate=function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=-n[3],t},n.inverse=function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t[3]=1/n[3],t},n.normalize=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=r*r+a*a+e*e+u*u;o>0&&(o=1/Math.sqrt(o),t[0]=r*o,t[1]=a*o,t[2]=e*o,t[3]=u*o);return t},n.dot=function(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]+t[3]*n[3]},n.lerp=function(t,n,r,a){var e=n[0],u=n[1],o=n[2],i=n[3];return t[0]=e+a*(r[0]-e),t[1]=u+a*(r[1]-u),t[2]=o+a*(r[2]-o),t[3]=i+a*(r[3]-i),t},n.random=function(t,n){var r,e,u,o,i,s;n=n||1;do{r=2*a.RANDOM()-1,e=2*a.RANDOM()-1,i=r*r+e*e}while(i>=1);do{u=2*a.RANDOM()-1,o=2*a.RANDOM()-1,s=u*u+o*o}while(s>=1);var c=Math.sqrt((1-i)/s);return t[0]=n*r,t[1]=n*e,t[2]=n*u*c,t[3]=n*o*c,t},n.transformMat4=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3];return t[0]=r[0]*a+r[4]*e+r[8]*u+r[12]*o,t[1]=r[1]*a+r[5]*e+r[9]*u+r[13]*o,t[2]=r[2]*a+r[6]*e+r[10]*u+r[14]*o,t[3]=r[3]*a+r[7]*e+r[11]*u+r[15]*o,t},n.transformQuat=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=r[0],i=r[1],s=r[2],c=r[3],f=c*a+i*u-s*e,M=c*e+s*a-o*u,h=c*u+o*e-i*a,l=-o*a-i*e-s*u;return t[0]=f*c+l*-o+M*-s-h*-i,t[1]=M*c+l*-i+h*-o-f*-s,t[2]=h*c+l*-s+f*-i-M*-o,t[3]=n[3],t},n.str=function(t){return"vec4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=n[0],s=n[1],c=n[2],f=n[3];return Math.abs(r-i)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(e-s)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(s))&&Math.abs(u-c)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(c))&&Math.abs(o-f)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(f))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(){var t=new a.ARRAY_TYPE(4);return a.ARRAY_TYPE!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[3]=0),t}function u(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t[3]=n[3]-r[3],t}function o(t,n,r){return t[0]=n[0]*r[0],t[1]=n[1]*r[1],t[2]=n[2]*r[2],t[3]=n[3]*r[3],t}function i(t,n,r){return t[0]=n[0]/r[0],t[1]=n[1]/r[1],t[2]=n[2]/r[2],t[3]=n[3]/r[3],t}function s(t,n){var r=n[0]-t[0],a=n[1]-t[1],e=n[2]-t[2],u=n[3]-t[3];return Math.sqrt(r*r+a*a+e*e+u*u)}function c(t,n){var r=n[0]-t[0],a=n[1]-t[1],e=n[2]-t[2],u=n[3]-t[3];return r*r+a*a+e*e+u*u}function f(t){var n=t[0],r=t[1],a=t[2],e=t[3];return Math.sqrt(n*n+r*r+a*a+e*e)}function M(t){var n=t[0],r=t[1],a=t[2],e=t[3];return n*n+r*r+a*a+e*e}n.sub=u,n.mul=o,n.div=i,n.dist=s,n.sqrDist=c,n.len=f,n.sqrLen=M,n.forEach=function(){var t=e();return function(n,r,a,e,u,o){var i=void 0,s=void 0;for(r||(r=4),a||(a=0),s=e?Math.min(e*r+a,n.length):n.length,i=a;i<s;i+=r)t[0]=n[i],t[1]=n[i+1],t[2]=n[i+2],t[3]=n[i+3],u(t,t,o),n[i]=t[0],n[i+1]=t[1],n[i+2]=t[2],n[i+3]=t[3];return n}}()},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.forEach=n.sqrLen=n.len=n.sqrDist=n.dist=n.div=n.mul=n.sub=void 0,n.create=e,n.clone=function(t){var n=new a.ARRAY_TYPE(3);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n},n.length=u,n.fromValues=o,n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t},n.set=function(t,n,r,a){return t[0]=n,t[1]=r,t[2]=a,t},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t},n.subtract=i,n.multiply=s,n.divide=c,n.ceil=function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t},n.floor=function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t},n.min=function(t,n,r){return t[0]=Math.min(n[0],r[0]),t[1]=Math.min(n[1],r[1]),t[2]=Math.min(n[2],r[2]),t},n.max=function(t,n,r){return t[0]=Math.max(n[0],r[0]),t[1]=Math.max(n[1],r[1]),t[2]=Math.max(n[2],r[2]),t},n.round=function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t},n.scale=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t},n.scaleAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t},n.distance=f,n.squaredDistance=M,n.squaredLength=h,n.negate=function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t},n.inverse=function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t},n.normalize=l,n.dot=v,n.cross=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=r[0],i=r[1],s=r[2];return t[0]=e*s-u*i,t[1]=u*o-a*s,t[2]=a*i-e*o,t},n.lerp=function(t,n,r,a){var e=n[0],u=n[1],o=n[2];return t[0]=e+a*(r[0]-e),t[1]=u+a*(r[1]-u),t[2]=o+a*(r[2]-o),t},n.hermite=function(t,n,r,a,e,u){var o=u*u,i=o*(2*u-3)+1,s=o*(u-2)+u,c=o*(u-1),f=o*(3-2*u);return t[0]=n[0]*i+r[0]*s+a[0]*c+e[0]*f,t[1]=n[1]*i+r[1]*s+a[1]*c+e[1]*f,t[2]=n[2]*i+r[2]*s+a[2]*c+e[2]*f,t},n.bezier=function(t,n,r,a,e,u){var o=1-u,i=o*o,s=u*u,c=i*o,f=3*u*i,M=3*s*o,h=s*u;return t[0]=n[0]*c+r[0]*f+a[0]*M+e[0]*h,t[1]=n[1]*c+r[1]*f+a[1]*M+e[1]*h,t[2]=n[2]*c+r[2]*f+a[2]*M+e[2]*h,t},n.random=function(t,n){n=n||1;var r=2*a.RANDOM()*Math.PI,e=2*a.RANDOM()-1,u=Math.sqrt(1-e*e)*n;return t[0]=Math.cos(r)*u,t[1]=Math.sin(r)*u,t[2]=e*n,t},n.transformMat4=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=r[3]*a+r[7]*e+r[11]*u+r[15];return o=o||1,t[0]=(r[0]*a+r[4]*e+r[8]*u+r[12])/o,t[1]=(r[1]*a+r[5]*e+r[9]*u+r[13])/o,t[2]=(r[2]*a+r[6]*e+r[10]*u+r[14])/o,t},n.transformMat3=function(t,n,r){var a=n[0],e=n[1],u=n[2];return t[0]=a*r[0]+e*r[3]+u*r[6],t[1]=a*r[1]+e*r[4]+u*r[7],t[2]=a*r[2]+e*r[5]+u*r[8],t},n.transformQuat=function(t,n,r){var a=r[0],e=r[1],u=r[2],o=r[3],i=n[0],s=n[1],c=n[2],f=e*c-u*s,M=u*i-a*c,h=a*s-e*i,l=e*h-u*M,v=u*f-a*h,d=a*M-e*f,b=2*o;return f*=b,M*=b,h*=b,l*=2,v*=2,d*=2,t[0]=i+f+l,t[1]=s+M+v,t[2]=c+h+d,t},n.rotateX=function(t,n,r,a){var e=[],u=[];return e[0]=n[0]-r[0],e[1]=n[1]-r[1],e[2]=n[2]-r[2],u[0]=e[0],u[1]=e[1]*Math.cos(a)-e[2]*Math.sin(a),u[2]=e[1]*Math.sin(a)+e[2]*Math.cos(a),t[0]=u[0]+r[0],t[1]=u[1]+r[1],t[2]=u[2]+r[2],t},n.rotateY=function(t,n,r,a){var e=[],u=[];return e[0]=n[0]-r[0],e[1]=n[1]-r[1],e[2]=n[2]-r[2],u[0]=e[2]*Math.sin(a)+e[0]*Math.cos(a),u[1]=e[1],u[2]=e[2]*Math.cos(a)-e[0]*Math.sin(a),t[0]=u[0]+r[0],t[1]=u[1]+r[1],t[2]=u[2]+r[2],t},n.rotateZ=function(t,n,r,a){var e=[],u=[];return e[0]=n[0]-r[0],e[1]=n[1]-r[1],e[2]=n[2]-r[2],u[0]=e[0]*Math.cos(a)-e[1]*Math.sin(a),u[1]=e[0]*Math.sin(a)+e[1]*Math.cos(a),u[2]=e[2],t[0]=u[0]+r[0],t[1]=u[1]+r[1],t[2]=u[2]+r[2],t},n.angle=function(t,n){var r=o(t[0],t[1],t[2]),a=o(n[0],n[1],n[2]);l(r,r),l(a,a);var e=v(r,a);return e>1?0:e<-1?Math.PI:Math.acos(e)},n.str=function(t){return"vec3("+t[0]+", "+t[1]+", "+t[2]+")"},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=n[0],i=n[1],s=n[2];return Math.abs(r-o)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(o))&&Math.abs(e-i)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(i))&&Math.abs(u-s)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(s))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(){var t=new a.ARRAY_TYPE(3);return a.ARRAY_TYPE!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function u(t){var n=t[0],r=t[1],a=t[2];return Math.sqrt(n*n+r*r+a*a)}function o(t,n,r){var e=new a.ARRAY_TYPE(3);return e[0]=t,e[1]=n,e[2]=r,e}function i(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t}function s(t,n,r){return t[0]=n[0]*r[0],t[1]=n[1]*r[1],t[2]=n[2]*r[2],t}function c(t,n,r){return t[0]=n[0]/r[0],t[1]=n[1]/r[1],t[2]=n[2]/r[2],t}function f(t,n){var r=n[0]-t[0],a=n[1]-t[1],e=n[2]-t[2];return Math.sqrt(r*r+a*a+e*e)}function M(t,n){var r=n[0]-t[0],a=n[1]-t[1],e=n[2]-t[2];return r*r+a*a+e*e}function h(t){var n=t[0],r=t[1],a=t[2];return n*n+r*r+a*a}function l(t,n){var r=n[0],a=n[1],e=n[2],u=r*r+a*a+e*e;return u>0&&(u=1/Math.sqrt(u),t[0]=n[0]*u,t[1]=n[1]*u,t[2]=n[2]*u),t}function v(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]}n.sub=i,n.mul=s,n.div=c,n.dist=f,n.sqrDist=M,n.len=u,n.sqrLen=h,n.forEach=function(){var t=e();return function(n,r,a,e,u,o){var i=void 0,s=void 0;for(r||(r=3),a||(a=0),s=e?Math.min(e*r+a,n.length):n.length,i=a;i<s;i+=r)t[0]=n[i],t[1]=n[i+1],t[2]=n[i+2],u(t,t,o),n[i]=t[0],n[i+1]=t[1],n[i+2]=t[2];return n}}()},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.setAxes=n.sqlerp=n.rotationTo=n.equals=n.exactEquals=n.normalize=n.sqrLen=n.squaredLength=n.len=n.length=n.lerp=n.dot=n.scale=n.mul=n.add=n.set=n.copy=n.fromValues=n.clone=void 0,n.create=s,n.identity=function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t},n.setAxisAngle=c,n.getAxisAngle=function(t,n){var r=2*Math.acos(n[3]),e=Math.sin(r/2);e>a.EPSILON?(t[0]=n[0]/e,t[1]=n[1]/e,t[2]=n[2]/e):(t[0]=1,t[1]=0,t[2]=0);return r},n.multiply=f,n.rotateX=function(t,n,r){r*=.5;var a=n[0],e=n[1],u=n[2],o=n[3],i=Math.sin(r),s=Math.cos(r);return t[0]=a*s+o*i,t[1]=e*s+u*i,t[2]=u*s-e*i,t[3]=o*s-a*i,t},n.rotateY=function(t,n,r){r*=.5;var a=n[0],e=n[1],u=n[2],o=n[3],i=Math.sin(r),s=Math.cos(r);return t[0]=a*s-u*i,t[1]=e*s+o*i,t[2]=u*s+a*i,t[3]=o*s-e*i,t},n.rotateZ=function(t,n,r){r*=.5;var a=n[0],e=n[1],u=n[2],o=n[3],i=Math.sin(r),s=Math.cos(r);return t[0]=a*s+e*i,t[1]=e*s-a*i,t[2]=u*s+o*i,t[3]=o*s-u*i,t},n.calculateW=function(t,n){var r=n[0],a=n[1],e=n[2];return t[0]=r,t[1]=a,t[2]=e,t[3]=Math.sqrt(Math.abs(1-r*r-a*a-e*e)),t},n.slerp=M,n.random=function(t){var n=a.RANDOM(),r=a.RANDOM(),e=a.RANDOM(),u=Math.sqrt(1-n),o=Math.sqrt(n);return t[0]=u*Math.sin(2*Math.PI*r),t[1]=u*Math.cos(2*Math.PI*r),t[2]=o*Math.sin(2*Math.PI*e),t[3]=o*Math.cos(2*Math.PI*e),t},n.invert=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=r*r+a*a+e*e+u*u,i=o?1/o:0;return t[0]=-r*i,t[1]=-a*i,t[2]=-e*i,t[3]=u*i,t},n.conjugate=function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t},n.fromMat3=h,n.fromEuler=function(t,n,r,a){var e=.5*Math.PI/180;n*=e,r*=e,a*=e;var u=Math.sin(n),o=Math.cos(n),i=Math.sin(r),s=Math.cos(r),c=Math.sin(a),f=Math.cos(a);return t[0]=u*s*f-o*i*c,t[1]=o*i*f+u*s*c,t[2]=o*s*c-u*i*f,t[3]=o*s*f+u*i*c,t},n.str=function(t){return"quat("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"};var a=i(r(0)),e=i(r(5)),u=i(r(2)),o=i(r(1));function i(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}function s(){var t=new a.ARRAY_TYPE(4);return a.ARRAY_TYPE!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t[3]=1,t}function c(t,n,r){r*=.5;var a=Math.sin(r);return t[0]=a*n[0],t[1]=a*n[1],t[2]=a*n[2],t[3]=Math.cos(r),t}function f(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=r[0],s=r[1],c=r[2],f=r[3];return t[0]=a*f+o*i+e*c-u*s,t[1]=e*f+o*s+u*i-a*c,t[2]=u*f+o*c+a*s-e*i,t[3]=o*f-a*i-e*s-u*c,t}function M(t,n,r,e){var u=n[0],o=n[1],i=n[2],s=n[3],c=r[0],f=r[1],M=r[2],h=r[3],l=void 0,v=void 0,d=void 0,b=void 0,m=void 0;return(v=u*c+o*f+i*M+s*h)<0&&(v=-v,c=-c,f=-f,M=-M,h=-h),1-v>a.EPSILON?(l=Math.acos(v),d=Math.sin(l),b=Math.sin((1-e)*l)/d,m=Math.sin(e*l)/d):(b=1-e,m=e),t[0]=b*u+m*c,t[1]=b*o+m*f,t[2]=b*i+m*M,t[3]=b*s+m*h,t}function h(t,n){var r=n[0]+n[4]+n[8],a=void 0;if(r>0)a=Math.sqrt(r+1),t[3]=.5*a,a=.5/a,t[0]=(n[5]-n[7])*a,t[1]=(n[6]-n[2])*a,t[2]=(n[1]-n[3])*a;else{var e=0;n[4]>n[0]&&(e=1),n[8]>n[3*e+e]&&(e=2);var u=(e+1)%3,o=(e+2)%3;a=Math.sqrt(n[3*e+e]-n[3*u+u]-n[3*o+o]+1),t[e]=.5*a,a=.5/a,t[3]=(n[3*u+o]-n[3*o+u])*a,t[u]=(n[3*u+e]+n[3*e+u])*a,t[o]=(n[3*o+e]+n[3*e+o])*a}return t}n.clone=o.clone,n.fromValues=o.fromValues,n.copy=o.copy,n.set=o.set,n.add=o.add,n.mul=f,n.scale=o.scale,n.dot=o.dot,n.lerp=o.lerp;var l=n.length=o.length,v=(n.len=l,n.squaredLength=o.squaredLength),d=(n.sqrLen=v,n.normalize=o.normalize);n.exactEquals=o.exactEquals,n.equals=o.equals,n.rotationTo=function(){var t=u.create(),n=u.fromValues(1,0,0),r=u.fromValues(0,1,0);return function(a,e,o){var i=u.dot(e,o);return i<-.999999?(u.cross(t,n,e),u.len(t)<1e-6&&u.cross(t,r,e),u.normalize(t,t),c(a,t,Math.PI),a):i>.999999?(a[0]=0,a[1]=0,a[2]=0,a[3]=1,a):(u.cross(t,e,o),a[0]=t[0],a[1]=t[1],a[2]=t[2],a[3]=1+i,d(a,a))}}(),n.sqlerp=function(){var t=s(),n=s();return function(r,a,e,u,o,i){return M(t,a,o,i),M(n,e,u,i),M(r,t,n,2*i*(1-i)),r}}(),n.setAxes=function(){var t=e.create();return function(n,r,a,e){return t[0]=a[0],t[3]=a[1],t[6]=a[2],t[1]=e[0],t[4]=e[1],t[7]=e[2],t[2]=-r[0],t[5]=-r[1],t[8]=-r[2],d(n,h(n,t))}}()},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.sub=n.mul=void 0,n.create=function(){var t=new a.ARRAY_TYPE(16);a.ARRAY_TYPE!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0);return t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},n.clone=function(t){var n=new a.ARRAY_TYPE(16);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n[9]=t[9],n[10]=t[10],n[11]=t[11],n[12]=t[12],n[13]=t[13],n[14]=t[14],n[15]=t[15],n},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},n.fromValues=function(t,n,r,e,u,o,i,s,c,f,M,h,l,v,d,b){var m=new a.ARRAY_TYPE(16);return m[0]=t,m[1]=n,m[2]=r,m[3]=e,m[4]=u,m[5]=o,m[6]=i,m[7]=s,m[8]=c,m[9]=f,m[10]=M,m[11]=h,m[12]=l,m[13]=v,m[14]=d,m[15]=b,m},n.set=function(t,n,r,a,e,u,o,i,s,c,f,M,h,l,v,d,b){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t[4]=u,t[5]=o,t[6]=i,t[7]=s,t[8]=c,t[9]=f,t[10]=M,t[11]=h,t[12]=l,t[13]=v,t[14]=d,t[15]=b,t},n.identity=e,n.transpose=function(t,n){if(t===n){var r=n[1],a=n[2],e=n[3],u=n[6],o=n[7],i=n[11];t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=r,t[6]=n[9],t[7]=n[13],t[8]=a,t[9]=u,t[11]=n[14],t[12]=e,t[13]=o,t[14]=i}else t[0]=n[0],t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=n[1],t[5]=n[5],t[6]=n[9],t[7]=n[13],t[8]=n[2],t[9]=n[6],t[10]=n[10],t[11]=n[14],t[12]=n[3],t[13]=n[7],t[14]=n[11],t[15]=n[15];return t},n.invert=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=n[6],c=n[7],f=n[8],M=n[9],h=n[10],l=n[11],v=n[12],d=n[13],b=n[14],m=n[15],p=r*i-a*o,P=r*s-e*o,A=r*c-u*o,E=a*s-e*i,O=a*c-u*i,R=e*c-u*s,y=f*d-M*v,q=f*b-h*v,x=f*m-l*v,_=M*b-h*d,Y=M*m-l*d,L=h*m-l*b,S=p*L-P*Y+A*_+E*x-O*q+R*y;if(!S)return null;return S=1/S,t[0]=(i*L-s*Y+c*_)*S,t[1]=(e*Y-a*L-u*_)*S,t[2]=(d*R-b*O+m*E)*S,t[3]=(h*O-M*R-l*E)*S,t[4]=(s*x-o*L-c*q)*S,t[5]=(r*L-e*x+u*q)*S,t[6]=(b*A-v*R-m*P)*S,t[7]=(f*R-h*A+l*P)*S,t[8]=(o*Y-i*x+c*y)*S,t[9]=(a*x-r*Y-u*y)*S,t[10]=(v*O-d*A+m*p)*S,t[11]=(M*A-f*O-l*p)*S,t[12]=(i*q-o*_-s*y)*S,t[13]=(r*_-a*q+e*y)*S,t[14]=(d*P-v*E-b*p)*S,t[15]=(f*E-M*P+h*p)*S,t},n.adjoint=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=n[6],c=n[7],f=n[8],M=n[9],h=n[10],l=n[11],v=n[12],d=n[13],b=n[14],m=n[15];return t[0]=i*(h*m-l*b)-M*(s*m-c*b)+d*(s*l-c*h),t[1]=-(a*(h*m-l*b)-M*(e*m-u*b)+d*(e*l-u*h)),t[2]=a*(s*m-c*b)-i*(e*m-u*b)+d*(e*c-u*s),t[3]=-(a*(s*l-c*h)-i*(e*l-u*h)+M*(e*c-u*s)),t[4]=-(o*(h*m-l*b)-f*(s*m-c*b)+v*(s*l-c*h)),t[5]=r*(h*m-l*b)-f*(e*m-u*b)+v*(e*l-u*h),t[6]=-(r*(s*m-c*b)-o*(e*m-u*b)+v*(e*c-u*s)),t[7]=r*(s*l-c*h)-o*(e*l-u*h)+f*(e*c-u*s),t[8]=o*(M*m-l*d)-f*(i*m-c*d)+v*(i*l-c*M),t[9]=-(r*(M*m-l*d)-f*(a*m-u*d)+v*(a*l-u*M)),t[10]=r*(i*m-c*d)-o*(a*m-u*d)+v*(a*c-u*i),t[11]=-(r*(i*l-c*M)-o*(a*l-u*M)+f*(a*c-u*i)),t[12]=-(o*(M*b-h*d)-f*(i*b-s*d)+v*(i*h-s*M)),t[13]=r*(M*b-h*d)-f*(a*b-e*d)+v*(a*h-e*M),t[14]=-(r*(i*b-s*d)-o*(a*b-e*d)+v*(a*s-e*i)),t[15]=r*(i*h-s*M)-o*(a*h-e*M)+f*(a*s-e*i),t},n.determinant=function(t){var n=t[0],r=t[1],a=t[2],e=t[3],u=t[4],o=t[5],i=t[6],s=t[7],c=t[8],f=t[9],M=t[10],h=t[11],l=t[12],v=t[13],d=t[14],b=t[15];return(n*o-r*u)*(M*b-h*d)-(n*i-a*u)*(f*b-h*v)+(n*s-e*u)*(f*d-M*v)+(r*i-a*o)*(c*b-h*l)-(r*s-e*o)*(c*d-M*l)+(a*s-e*i)*(c*v-f*l)},n.multiply=u,n.translate=function(t,n,r){var a=r[0],e=r[1],u=r[2],o=void 0,i=void 0,s=void 0,c=void 0,f=void 0,M=void 0,h=void 0,l=void 0,v=void 0,d=void 0,b=void 0,m=void 0;n===t?(t[12]=n[0]*a+n[4]*e+n[8]*u+n[12],t[13]=n[1]*a+n[5]*e+n[9]*u+n[13],t[14]=n[2]*a+n[6]*e+n[10]*u+n[14],t[15]=n[3]*a+n[7]*e+n[11]*u+n[15]):(o=n[0],i=n[1],s=n[2],c=n[3],f=n[4],M=n[5],h=n[6],l=n[7],v=n[8],d=n[9],b=n[10],m=n[11],t[0]=o,t[1]=i,t[2]=s,t[3]=c,t[4]=f,t[5]=M,t[6]=h,t[7]=l,t[8]=v,t[9]=d,t[10]=b,t[11]=m,t[12]=o*a+f*e+v*u+n[12],t[13]=i*a+M*e+d*u+n[13],t[14]=s*a+h*e+b*u+n[14],t[15]=c*a+l*e+m*u+n[15]);return t},n.scale=function(t,n,r){var a=r[0],e=r[1],u=r[2];return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*e,t[5]=n[5]*e,t[6]=n[6]*e,t[7]=n[7]*e,t[8]=n[8]*u,t[9]=n[9]*u,t[10]=n[10]*u,t[11]=n[11]*u,t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},n.rotate=function(t,n,r,e){var u=e[0],o=e[1],i=e[2],s=Math.sqrt(u*u+o*o+i*i),c=void 0,f=void 0,M=void 0,h=void 0,l=void 0,v=void 0,d=void 0,b=void 0,m=void 0,p=void 0,P=void 0,A=void 0,E=void 0,O=void 0,R=void 0,y=void 0,q=void 0,x=void 0,_=void 0,Y=void 0,L=void 0,S=void 0,w=void 0,I=void 0;if(s<a.EPSILON)return null;u*=s=1/s,o*=s,i*=s,c=Math.sin(r),f=Math.cos(r),M=1-f,h=n[0],l=n[1],v=n[2],d=n[3],b=n[4],m=n[5],p=n[6],P=n[7],A=n[8],E=n[9],O=n[10],R=n[11],y=u*u*M+f,q=o*u*M+i*c,x=i*u*M-o*c,_=u*o*M-i*c,Y=o*o*M+f,L=i*o*M+u*c,S=u*i*M+o*c,w=o*i*M-u*c,I=i*i*M+f,t[0]=h*y+b*q+A*x,t[1]=l*y+m*q+E*x,t[2]=v*y+p*q+O*x,t[3]=d*y+P*q+R*x,t[4]=h*_+b*Y+A*L,t[5]=l*_+m*Y+E*L,t[6]=v*_+p*Y+O*L,t[7]=d*_+P*Y+R*L,t[8]=h*S+b*w+A*I,t[9]=l*S+m*w+E*I,t[10]=v*S+p*w+O*I,t[11]=d*S+P*w+R*I,n!==t&&(t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]);return t},n.rotateX=function(t,n,r){var a=Math.sin(r),e=Math.cos(r),u=n[4],o=n[5],i=n[6],s=n[7],c=n[8],f=n[9],M=n[10],h=n[11];n!==t&&(t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]);return t[4]=u*e+c*a,t[5]=o*e+f*a,t[6]=i*e+M*a,t[7]=s*e+h*a,t[8]=c*e-u*a,t[9]=f*e-o*a,t[10]=M*e-i*a,t[11]=h*e-s*a,t},n.rotateY=function(t,n,r){var a=Math.sin(r),e=Math.cos(r),u=n[0],o=n[1],i=n[2],s=n[3],c=n[8],f=n[9],M=n[10],h=n[11];n!==t&&(t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]);return t[0]=u*e-c*a,t[1]=o*e-f*a,t[2]=i*e-M*a,t[3]=s*e-h*a,t[8]=u*a+c*e,t[9]=o*a+f*e,t[10]=i*a+M*e,t[11]=s*a+h*e,t},n.rotateZ=function(t,n,r){var a=Math.sin(r),e=Math.cos(r),u=n[0],o=n[1],i=n[2],s=n[3],c=n[4],f=n[5],M=n[6],h=n[7];n!==t&&(t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]);return t[0]=u*e+c*a,t[1]=o*e+f*a,t[2]=i*e+M*a,t[3]=s*e+h*a,t[4]=c*e-u*a,t[5]=f*e-o*a,t[6]=M*e-i*a,t[7]=h*e-s*a,t},n.fromTranslation=function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=n[0],t[13]=n[1],t[14]=n[2],t[15]=1,t},n.fromScaling=function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=n[1],t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=n[2],t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.fromRotation=function(t,n,r){var e=r[0],u=r[1],o=r[2],i=Math.sqrt(e*e+u*u+o*o),s=void 0,c=void 0,f=void 0;if(i<a.EPSILON)return null;return e*=i=1/i,u*=i,o*=i,s=Math.sin(n),c=Math.cos(n),f=1-c,t[0]=e*e*f+c,t[1]=u*e*f+o*s,t[2]=o*e*f-u*s,t[3]=0,t[4]=e*u*f-o*s,t[5]=u*u*f+c,t[6]=o*u*f+e*s,t[7]=0,t[8]=e*o*f+u*s,t[9]=u*o*f-e*s,t[10]=o*o*f+c,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.fromXRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=a,t[6]=r,t[7]=0,t[8]=0,t[9]=-r,t[10]=a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.fromYRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=a,t[1]=0,t[2]=-r,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=r,t[9]=0,t[10]=a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.fromZRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=a,t[1]=r,t[2]=0,t[3]=0,t[4]=-r,t[5]=a,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.fromRotationTranslation=o,n.fromQuat2=function(t,n){var r=new a.ARRAY_TYPE(3),e=-n[0],u=-n[1],i=-n[2],s=n[3],c=n[4],f=n[5],M=n[6],h=n[7],l=e*e+u*u+i*i+s*s;l>0?(r[0]=2*(c*s+h*e+f*i-M*u)/l,r[1]=2*(f*s+h*u+M*e-c*i)/l,r[2]=2*(M*s+h*i+c*u-f*e)/l):(r[0]=2*(c*s+h*e+f*i-M*u),r[1]=2*(f*s+h*u+M*e-c*i),r[2]=2*(M*s+h*i+c*u-f*e));return o(t,n,r),t},n.getTranslation=function(t,n){return t[0]=n[12],t[1]=n[13],t[2]=n[14],t},n.getScaling=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[4],o=n[5],i=n[6],s=n[8],c=n[9],f=n[10];return t[0]=Math.sqrt(r*r+a*a+e*e),t[1]=Math.sqrt(u*u+o*o+i*i),t[2]=Math.sqrt(s*s+c*c+f*f),t},n.getRotation=function(t,n){var r=n[0]+n[5]+n[10],a=0;r>0?(a=2*Math.sqrt(r+1),t[3]=.25*a,t[0]=(n[6]-n[9])/a,t[1]=(n[8]-n[2])/a,t[2]=(n[1]-n[4])/a):n[0]>n[5]&&n[0]>n[10]?(a=2*Math.sqrt(1+n[0]-n[5]-n[10]),t[3]=(n[6]-n[9])/a,t[0]=.25*a,t[1]=(n[1]+n[4])/a,t[2]=(n[8]+n[2])/a):n[5]>n[10]?(a=2*Math.sqrt(1+n[5]-n[0]-n[10]),t[3]=(n[8]-n[2])/a,t[0]=(n[1]+n[4])/a,t[1]=.25*a,t[2]=(n[6]+n[9])/a):(a=2*Math.sqrt(1+n[10]-n[0]-n[5]),t[3]=(n[1]-n[4])/a,t[0]=(n[8]+n[2])/a,t[1]=(n[6]+n[9])/a,t[2]=.25*a);return t},n.fromRotationTranslationScale=function(t,n,r,a){var e=n[0],u=n[1],o=n[2],i=n[3],s=e+e,c=u+u,f=o+o,M=e*s,h=e*c,l=e*f,v=u*c,d=u*f,b=o*f,m=i*s,p=i*c,P=i*f,A=a[0],E=a[1],O=a[2];return t[0]=(1-(v+b))*A,t[1]=(h+P)*A,t[2]=(l-p)*A,t[3]=0,t[4]=(h-P)*E,t[5]=(1-(M+b))*E,t[6]=(d+m)*E,t[7]=0,t[8]=(l+p)*O,t[9]=(d-m)*O,t[10]=(1-(M+v))*O,t[11]=0,t[12]=r[0],t[13]=r[1],t[14]=r[2],t[15]=1,t},n.fromRotationTranslationScaleOrigin=function(t,n,r,a,e){var u=n[0],o=n[1],i=n[2],s=n[3],c=u+u,f=o+o,M=i+i,h=u*c,l=u*f,v=u*M,d=o*f,b=o*M,m=i*M,p=s*c,P=s*f,A=s*M,E=a[0],O=a[1],R=a[2],y=e[0],q=e[1],x=e[2],_=(1-(d+m))*E,Y=(l+A)*E,L=(v-P)*E,S=(l-A)*O,w=(1-(h+m))*O,I=(b+p)*O,N=(v+P)*R,g=(b-p)*R,T=(1-(h+d))*R;return t[0]=_,t[1]=Y,t[2]=L,t[3]=0,t[4]=S,t[5]=w,t[6]=I,t[7]=0,t[8]=N,t[9]=g,t[10]=T,t[11]=0,t[12]=r[0]+y-(_*y+S*q+N*x),t[13]=r[1]+q-(Y*y+w*q+g*x),t[14]=r[2]+x-(L*y+I*q+T*x),t[15]=1,t},n.fromQuat=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=r+r,i=a+a,s=e+e,c=r*o,f=a*o,M=a*i,h=e*o,l=e*i,v=e*s,d=u*o,b=u*i,m=u*s;return t[0]=1-M-v,t[1]=f+m,t[2]=h-b,t[3]=0,t[4]=f-m,t[5]=1-c-v,t[6]=l+d,t[7]=0,t[8]=h+b,t[9]=l-d,t[10]=1-c-M,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},n.frustum=function(t,n,r,a,e,u,o){var i=1/(r-n),s=1/(e-a),c=1/(u-o);return t[0]=2*u*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=2*u*s,t[6]=0,t[7]=0,t[8]=(r+n)*i,t[9]=(e+a)*s,t[10]=(o+u)*c,t[11]=-1,t[12]=0,t[13]=0,t[14]=o*u*2*c,t[15]=0,t},n.perspective=function(t,n,r,a,e){var u=1/Math.tan(n/2),o=void 0;t[0]=u/r,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=u,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=e&&e!==1/0?(o=1/(a-e),t[10]=(e+a)*o,t[14]=2*e*a*o):(t[10]=-1,t[14]=-2*a);return t},n.perspectiveFromFieldOfView=function(t,n,r,a){var e=Math.tan(n.upDegrees*Math.PI/180),u=Math.tan(n.downDegrees*Math.PI/180),o=Math.tan(n.leftDegrees*Math.PI/180),i=Math.tan(n.rightDegrees*Math.PI/180),s=2/(o+i),c=2/(e+u);return t[0]=s,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=c,t[6]=0,t[7]=0,t[8]=-(o-i)*s*.5,t[9]=(e-u)*c*.5,t[10]=a/(r-a),t[11]=-1,t[12]=0,t[13]=0,t[14]=a*r/(r-a),t[15]=0,t},n.ortho=function(t,n,r,a,e,u,o){var i=1/(n-r),s=1/(a-e),c=1/(u-o);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*s,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=2*c,t[11]=0,t[12]=(n+r)*i,t[13]=(e+a)*s,t[14]=(o+u)*c,t[15]=1,t},n.lookAt=function(t,n,r,u){var o=void 0,i=void 0,s=void 0,c=void 0,f=void 0,M=void 0,h=void 0,l=void 0,v=void 0,d=void 0,b=n[0],m=n[1],p=n[2],P=u[0],A=u[1],E=u[2],O=r[0],R=r[1],y=r[2];if(Math.abs(b-O)<a.EPSILON&&Math.abs(m-R)<a.EPSILON&&Math.abs(p-y)<a.EPSILON)return e(t);h=b-O,l=m-R,v=p-y,d=1/Math.sqrt(h*h+l*l+v*v),o=A*(v*=d)-E*(l*=d),i=E*(h*=d)-P*v,s=P*l-A*h,(d=Math.sqrt(o*o+i*i+s*s))?(o*=d=1/d,i*=d,s*=d):(o=0,i=0,s=0);c=l*s-v*i,f=v*o-h*s,M=h*i-l*o,(d=Math.sqrt(c*c+f*f+M*M))?(c*=d=1/d,f*=d,M*=d):(c=0,f=0,M=0);return t[0]=o,t[1]=c,t[2]=h,t[3]=0,t[4]=i,t[5]=f,t[6]=l,t[7]=0,t[8]=s,t[9]=M,t[10]=v,t[11]=0,t[12]=-(o*b+i*m+s*p),t[13]=-(c*b+f*m+M*p),t[14]=-(h*b+l*m+v*p),t[15]=1,t},n.targetTo=function(t,n,r,a){var e=n[0],u=n[1],o=n[2],i=a[0],s=a[1],c=a[2],f=e-r[0],M=u-r[1],h=o-r[2],l=f*f+M*M+h*h;l>0&&(l=1/Math.sqrt(l),f*=l,M*=l,h*=l);var v=s*h-c*M,d=c*f-i*h,b=i*M-s*f;(l=v*v+d*d+b*b)>0&&(l=1/Math.sqrt(l),v*=l,d*=l,b*=l);return t[0]=v,t[1]=d,t[2]=b,t[3]=0,t[4]=M*b-h*d,t[5]=h*v-f*b,t[6]=f*d-M*v,t[7]=0,t[8]=f,t[9]=M,t[10]=h,t[11]=0,t[12]=e,t[13]=u,t[14]=o,t[15]=1,t},n.str=function(t){return"mat4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+", "+t[9]+", "+t[10]+", "+t[11]+", "+t[12]+", "+t[13]+", "+t[14]+", "+t[15]+")"},n.frob=function(t){return Math.sqrt(Math.pow(t[0],2)+Math.pow(t[1],2)+Math.pow(t[2],2)+Math.pow(t[3],2)+Math.pow(t[4],2)+Math.pow(t[5],2)+Math.pow(t[6],2)+Math.pow(t[7],2)+Math.pow(t[8],2)+Math.pow(t[9],2)+Math.pow(t[10],2)+Math.pow(t[11],2)+Math.pow(t[12],2)+Math.pow(t[13],2)+Math.pow(t[14],2)+Math.pow(t[15],2))},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t[4]=n[4]+r[4],t[5]=n[5]+r[5],t[6]=n[6]+r[6],t[7]=n[7]+r[7],t[8]=n[8]+r[8],t[9]=n[9]+r[9],t[10]=n[10]+r[10],t[11]=n[11]+r[11],t[12]=n[12]+r[12],t[13]=n[13]+r[13],t[14]=n[14]+r[14],t[15]=n[15]+r[15],t},n.subtract=i,n.multiplyScalar=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=n[7]*r,t[8]=n[8]*r,t[9]=n[9]*r,t[10]=n[10]*r,t[11]=n[11]*r,t[12]=n[12]*r,t[13]=n[13]*r,t[14]=n[14]*r,t[15]=n[15]*r,t},n.multiplyScalarAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t[3]=n[3]+r[3]*a,t[4]=n[4]+r[4]*a,t[5]=n[5]+r[5]*a,t[6]=n[6]+r[6]*a,t[7]=n[7]+r[7]*a,t[8]=n[8]+r[8]*a,t[9]=n[9]+r[9]*a,t[10]=n[10]+r[10]*a,t[11]=n[11]+r[11]*a,t[12]=n[12]+r[12]*a,t[13]=n[13]+r[13]*a,t[14]=n[14]+r[14]*a,t[15]=n[15]+r[15]*a,t},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]&&t[9]===n[9]&&t[10]===n[10]&&t[11]===n[11]&&t[12]===n[12]&&t[13]===n[13]&&t[14]===n[14]&&t[15]===n[15]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=t[4],s=t[5],c=t[6],f=t[7],M=t[8],h=t[9],l=t[10],v=t[11],d=t[12],b=t[13],m=t[14],p=t[15],P=n[0],A=n[1],E=n[2],O=n[3],R=n[4],y=n[5],q=n[6],x=n[7],_=n[8],Y=n[9],L=n[10],S=n[11],w=n[12],I=n[13],N=n[14],g=n[15];return Math.abs(r-P)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(P))&&Math.abs(e-A)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(A))&&Math.abs(u-E)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(E))&&Math.abs(o-O)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(O))&&Math.abs(i-R)<=a.EPSILON*Math.max(1,Math.abs(i),Math.abs(R))&&Math.abs(s-y)<=a.EPSILON*Math.max(1,Math.abs(s),Math.abs(y))&&Math.abs(c-q)<=a.EPSILON*Math.max(1,Math.abs(c),Math.abs(q))&&Math.abs(f-x)<=a.EPSILON*Math.max(1,Math.abs(f),Math.abs(x))&&Math.abs(M-_)<=a.EPSILON*Math.max(1,Math.abs(M),Math.abs(_))&&Math.abs(h-Y)<=a.EPSILON*Math.max(1,Math.abs(h),Math.abs(Y))&&Math.abs(l-L)<=a.EPSILON*Math.max(1,Math.abs(l),Math.abs(L))&&Math.abs(v-S)<=a.EPSILON*Math.max(1,Math.abs(v),Math.abs(S))&&Math.abs(d-w)<=a.EPSILON*Math.max(1,Math.abs(d),Math.abs(w))&&Math.abs(b-I)<=a.EPSILON*Math.max(1,Math.abs(b),Math.abs(I))&&Math.abs(m-N)<=a.EPSILON*Math.max(1,Math.abs(m),Math.abs(N))&&Math.abs(p-g)<=a.EPSILON*Math.max(1,Math.abs(p),Math.abs(g))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function u(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=n[6],f=n[7],M=n[8],h=n[9],l=n[10],v=n[11],d=n[12],b=n[13],m=n[14],p=n[15],P=r[0],A=r[1],E=r[2],O=r[3];return t[0]=P*a+A*i+E*M+O*d,t[1]=P*e+A*s+E*h+O*b,t[2]=P*u+A*c+E*l+O*m,t[3]=P*o+A*f+E*v+O*p,P=r[4],A=r[5],E=r[6],O=r[7],t[4]=P*a+A*i+E*M+O*d,t[5]=P*e+A*s+E*h+O*b,t[6]=P*u+A*c+E*l+O*m,t[7]=P*o+A*f+E*v+O*p,P=r[8],A=r[9],E=r[10],O=r[11],t[8]=P*a+A*i+E*M+O*d,t[9]=P*e+A*s+E*h+O*b,t[10]=P*u+A*c+E*l+O*m,t[11]=P*o+A*f+E*v+O*p,P=r[12],A=r[13],E=r[14],O=r[15],t[12]=P*a+A*i+E*M+O*d,t[13]=P*e+A*s+E*h+O*b,t[14]=P*u+A*c+E*l+O*m,t[15]=P*o+A*f+E*v+O*p,t}function o(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=a+a,s=e+e,c=u+u,f=a*i,M=a*s,h=a*c,l=e*s,v=e*c,d=u*c,b=o*i,m=o*s,p=o*c;return t[0]=1-(l+d),t[1]=M+p,t[2]=h-m,t[3]=0,t[4]=M-p,t[5]=1-(f+d),t[6]=v+b,t[7]=0,t[8]=h+m,t[9]=v-b,t[10]=1-(f+l),t[11]=0,t[12]=r[0],t[13]=r[1],t[14]=r[2],t[15]=1,t}function i(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t[3]=n[3]-r[3],t[4]=n[4]-r[4],t[5]=n[5]-r[5],t[6]=n[6]-r[6],t[7]=n[7]-r[7],t[8]=n[8]-r[8],t[9]=n[9]-r[9],t[10]=n[10]-r[10],t[11]=n[11]-r[11],t[12]=n[12]-r[12],t[13]=n[13]-r[13],t[14]=n[14]-r[14],t[15]=n[15]-r[15],t}n.mul=u,n.sub=i},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.sub=n.mul=void 0,n.create=function(){var t=new a.ARRAY_TYPE(9);a.ARRAY_TYPE!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[5]=0,t[6]=0,t[7]=0);return t[0]=1,t[4]=1,t[8]=1,t},n.fromMat4=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[4],t[4]=n[5],t[5]=n[6],t[6]=n[8],t[7]=n[9],t[8]=n[10],t},n.clone=function(t){var n=new a.ARRAY_TYPE(9);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},n.fromValues=function(t,n,r,e,u,o,i,s,c){var f=new a.ARRAY_TYPE(9);return f[0]=t,f[1]=n,f[2]=r,f[3]=e,f[4]=u,f[5]=o,f[6]=i,f[7]=s,f[8]=c,f},n.set=function(t,n,r,a,e,u,o,i,s,c){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t[4]=u,t[5]=o,t[6]=i,t[7]=s,t[8]=c,t},n.identity=function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},n.transpose=function(t,n){if(t===n){var r=n[1],a=n[2],e=n[5];t[1]=n[3],t[2]=n[6],t[3]=r,t[5]=n[7],t[6]=a,t[7]=e}else t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8];return t},n.invert=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=n[6],c=n[7],f=n[8],M=f*o-i*c,h=-f*u+i*s,l=c*u-o*s,v=r*M+a*h+e*l;if(!v)return null;return v=1/v,t[0]=M*v,t[1]=(-f*a+e*c)*v,t[2]=(i*a-e*o)*v,t[3]=h*v,t[4]=(f*r-e*s)*v,t[5]=(-i*r+e*u)*v,t[6]=l*v,t[7]=(-c*r+a*s)*v,t[8]=(o*r-a*u)*v,t},n.adjoint=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=n[6],c=n[7],f=n[8];return t[0]=o*f-i*c,t[1]=e*c-a*f,t[2]=a*i-e*o,t[3]=i*s-u*f,t[4]=r*f-e*s,t[5]=e*u-r*i,t[6]=u*c-o*s,t[7]=a*s-r*c,t[8]=r*o-a*u,t},n.determinant=function(t){var n=t[0],r=t[1],a=t[2],e=t[3],u=t[4],o=t[5],i=t[6],s=t[7],c=t[8];return n*(c*u-o*s)+r*(-c*e+o*i)+a*(s*e-u*i)},n.multiply=e,n.translate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=n[6],f=n[7],M=n[8],h=r[0],l=r[1];return t[0]=a,t[1]=e,t[2]=u,t[3]=o,t[4]=i,t[5]=s,t[6]=h*a+l*o+c,t[7]=h*e+l*i+f,t[8]=h*u+l*s+M,t},n.rotate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=n[6],f=n[7],M=n[8],h=Math.sin(r),l=Math.cos(r);return t[0]=l*a+h*o,t[1]=l*e+h*i,t[2]=l*u+h*s,t[3]=l*o-h*a,t[4]=l*i-h*e,t[5]=l*s-h*u,t[6]=c,t[7]=f,t[8]=M,t},n.scale=function(t,n,r){var a=r[0],e=r[1];return t[0]=a*n[0],t[1]=a*n[1],t[2]=a*n[2],t[3]=e*n[3],t[4]=e*n[4],t[5]=e*n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},n.fromTranslation=function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=n[0],t[7]=n[1],t[8]=1,t},n.fromRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=a,t[1]=r,t[2]=0,t[3]=-r,t[4]=a,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},n.fromScaling=function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=n[1],t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},n.fromMat2d=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=0,t[3]=n[2],t[4]=n[3],t[5]=0,t[6]=n[4],t[7]=n[5],t[8]=1,t},n.fromQuat=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=r+r,i=a+a,s=e+e,c=r*o,f=a*o,M=a*i,h=e*o,l=e*i,v=e*s,d=u*o,b=u*i,m=u*s;return t[0]=1-M-v,t[3]=f-m,t[6]=h+b,t[1]=f+m,t[4]=1-c-v,t[7]=l-d,t[2]=h-b,t[5]=l+d,t[8]=1-c-M,t},n.normalFromMat4=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=n[6],c=n[7],f=n[8],M=n[9],h=n[10],l=n[11],v=n[12],d=n[13],b=n[14],m=n[15],p=r*i-a*o,P=r*s-e*o,A=r*c-u*o,E=a*s-e*i,O=a*c-u*i,R=e*c-u*s,y=f*d-M*v,q=f*b-h*v,x=f*m-l*v,_=M*b-h*d,Y=M*m-l*d,L=h*m-l*b,S=p*L-P*Y+A*_+E*x-O*q+R*y;if(!S)return null;return S=1/S,t[0]=(i*L-s*Y+c*_)*S,t[1]=(s*x-o*L-c*q)*S,t[2]=(o*Y-i*x+c*y)*S,t[3]=(e*Y-a*L-u*_)*S,t[4]=(r*L-e*x+u*q)*S,t[5]=(a*x-r*Y-u*y)*S,t[6]=(d*R-b*O+m*E)*S,t[7]=(b*A-v*R-m*P)*S,t[8]=(v*O-d*A+m*p)*S,t},n.projection=function(t,n,r){return t[0]=2/n,t[1]=0,t[2]=0,t[3]=0,t[4]=-2/r,t[5]=0,t[6]=-1,t[7]=1,t[8]=1,t},n.str=function(t){return"mat3("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+")"},n.frob=function(t){return Math.sqrt(Math.pow(t[0],2)+Math.pow(t[1],2)+Math.pow(t[2],2)+Math.pow(t[3],2)+Math.pow(t[4],2)+Math.pow(t[5],2)+Math.pow(t[6],2)+Math.pow(t[7],2)+Math.pow(t[8],2))},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t[4]=n[4]+r[4],t[5]=n[5]+r[5],t[6]=n[6]+r[6],t[7]=n[7]+r[7],t[8]=n[8]+r[8],t},n.subtract=u,n.multiplyScalar=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=n[7]*r,t[8]=n[8]*r,t},n.multiplyScalarAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t[3]=n[3]+r[3]*a,t[4]=n[4]+r[4]*a,t[5]=n[5]+r[5]*a,t[6]=n[6]+r[6]*a,t[7]=n[7]+r[7]*a,t[8]=n[8]+r[8]*a,t},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=t[4],s=t[5],c=t[6],f=t[7],M=t[8],h=n[0],l=n[1],v=n[2],d=n[3],b=n[4],m=n[5],p=n[6],P=n[7],A=n[8];return Math.abs(r-h)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(h))&&Math.abs(e-l)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(l))&&Math.abs(u-v)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(v))&&Math.abs(o-d)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(d))&&Math.abs(i-b)<=a.EPSILON*Math.max(1,Math.abs(i),Math.abs(b))&&Math.abs(s-m)<=a.EPSILON*Math.max(1,Math.abs(s),Math.abs(m))&&Math.abs(c-p)<=a.EPSILON*Math.max(1,Math.abs(c),Math.abs(p))&&Math.abs(f-P)<=a.EPSILON*Math.max(1,Math.abs(f),Math.abs(P))&&Math.abs(M-A)<=a.EPSILON*Math.max(1,Math.abs(M),Math.abs(A))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=n[6],f=n[7],M=n[8],h=r[0],l=r[1],v=r[2],d=r[3],b=r[4],m=r[5],p=r[6],P=r[7],A=r[8];return t[0]=h*a+l*o+v*c,t[1]=h*e+l*i+v*f,t[2]=h*u+l*s+v*M,t[3]=d*a+b*o+m*c,t[4]=d*e+b*i+m*f,t[5]=d*u+b*s+m*M,t[6]=p*a+P*o+A*c,t[7]=p*e+P*i+A*f,t[8]=p*u+P*s+A*M,t}function u(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t[3]=n[3]-r[3],t[4]=n[4]-r[4],t[5]=n[5]-r[5],t[6]=n[6]-r[6],t[7]=n[7]-r[7],t[8]=n[8]-r[8],t}n.mul=e,n.sub=u},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.forEach=n.sqrLen=n.sqrDist=n.dist=n.div=n.mul=n.sub=n.len=void 0,n.create=e,n.clone=function(t){var n=new a.ARRAY_TYPE(2);return n[0]=t[0],n[1]=t[1],n},n.fromValues=function(t,n){var r=new a.ARRAY_TYPE(2);return r[0]=t,r[1]=n,r},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t},n.set=function(t,n,r){return t[0]=n,t[1]=r,t},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t},n.subtract=u,n.multiply=o,n.divide=i,n.ceil=function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t},n.floor=function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t},n.min=function(t,n,r){return t[0]=Math.min(n[0],r[0]),t[1]=Math.min(n[1],r[1]),t},n.max=function(t,n,r){return t[0]=Math.max(n[0],r[0]),t[1]=Math.max(n[1],r[1]),t},n.round=function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t},n.scale=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t},n.scaleAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t},n.distance=s,n.squaredDistance=c,n.length=f,n.squaredLength=M,n.negate=function(t,n){return t[0]=-n[0],t[1]=-n[1],t},n.inverse=function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t},n.normalize=function(t,n){var r=n[0],a=n[1],e=r*r+a*a;e>0&&(e=1/Math.sqrt(e),t[0]=n[0]*e,t[1]=n[1]*e);return t},n.dot=function(t,n){return t[0]*n[0]+t[1]*n[1]},n.cross=function(t,n,r){var a=n[0]*r[1]-n[1]*r[0];return t[0]=t[1]=0,t[2]=a,t},n.lerp=function(t,n,r,a){var e=n[0],u=n[1];return t[0]=e+a*(r[0]-e),t[1]=u+a*(r[1]-u),t},n.random=function(t,n){n=n||1;var r=2*a.RANDOM()*Math.PI;return t[0]=Math.cos(r)*n,t[1]=Math.sin(r)*n,t},n.transformMat2=function(t,n,r){var a=n[0],e=n[1];return t[0]=r[0]*a+r[2]*e,t[1]=r[1]*a+r[3]*e,t},n.transformMat2d=function(t,n,r){var a=n[0],e=n[1];return t[0]=r[0]*a+r[2]*e+r[4],t[1]=r[1]*a+r[3]*e+r[5],t},n.transformMat3=function(t,n,r){var a=n[0],e=n[1];return t[0]=r[0]*a+r[3]*e+r[6],t[1]=r[1]*a+r[4]*e+r[7],t},n.transformMat4=function(t,n,r){var a=n[0],e=n[1];return t[0]=r[0]*a+r[4]*e+r[12],t[1]=r[1]*a+r[5]*e+r[13],t},n.rotate=function(t,n,r,a){var e=n[0]-r[0],u=n[1]-r[1],o=Math.sin(a),i=Math.cos(a);return t[0]=e*i-u*o+r[0],t[1]=e*o+u*i+r[1],t},n.angle=function(t,n){var r=t[0],a=t[1],e=n[0],u=n[1],o=r*r+a*a;o>0&&(o=1/Math.sqrt(o));var i=e*e+u*u;i>0&&(i=1/Math.sqrt(i));var s=(r*e+a*u)*o*i;return s>1?0:s<-1?Math.PI:Math.acos(s)},n.str=function(t){return"vec2("+t[0]+", "+t[1]+")"},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]},n.equals=function(t,n){var r=t[0],e=t[1],u=n[0],o=n[1];return Math.abs(r-u)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(u))&&Math.abs(e-o)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(o))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(){var t=new a.ARRAY_TYPE(2);return a.ARRAY_TYPE!=Float32Array&&(t[0]=0,t[1]=0),t}function u(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t}function o(t,n,r){return t[0]=n[0]*r[0],t[1]=n[1]*r[1],t}function i(t,n,r){return t[0]=n[0]/r[0],t[1]=n[1]/r[1],t}function s(t,n){var r=n[0]-t[0],a=n[1]-t[1];return Math.sqrt(r*r+a*a)}function c(t,n){var r=n[0]-t[0],a=n[1]-t[1];return r*r+a*a}function f(t){var n=t[0],r=t[1];return Math.sqrt(n*n+r*r)}function M(t){var n=t[0],r=t[1];return n*n+r*r}n.len=f,n.sub=u,n.mul=o,n.div=i,n.dist=s,n.sqrDist=c,n.sqrLen=M,n.forEach=function(){var t=e();return function(n,r,a,e,u,o){var i=void 0,s=void 0;for(r||(r=2),a||(a=0),s=e?Math.min(e*r+a,n.length):n.length,i=a;i<s;i+=r)t[0]=n[i],t[1]=n[i+1],u(t,t,o),n[i]=t[0],n[i+1]=t[1];return n}}()},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.sqrLen=n.squaredLength=n.len=n.length=n.dot=n.mul=n.setReal=n.getReal=void 0,n.create=function(){var t=new a.ARRAY_TYPE(8);a.ARRAY_TYPE!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[4]=0,t[5]=0,t[6]=0,t[7]=0);return t[3]=1,t},n.clone=function(t){var n=new a.ARRAY_TYPE(8);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n},n.fromValues=function(t,n,r,e,u,o,i,s){var c=new a.ARRAY_TYPE(8);return c[0]=t,c[1]=n,c[2]=r,c[3]=e,c[4]=u,c[5]=o,c[6]=i,c[7]=s,c},n.fromRotationTranslationValues=function(t,n,r,e,u,o,i){var s=new a.ARRAY_TYPE(8);s[0]=t,s[1]=n,s[2]=r,s[3]=e;var c=.5*u,f=.5*o,M=.5*i;return s[4]=c*e+f*r-M*n,s[5]=f*e+M*t-c*r,s[6]=M*e+c*n-f*t,s[7]=-c*t-f*n-M*r,s},n.fromRotationTranslation=i,n.fromTranslation=function(t,n){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=.5*n[0],t[5]=.5*n[1],t[6]=.5*n[2],t[7]=0,t},n.fromRotation=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},n.fromMat4=function(t,n){var r=e.create();u.getRotation(r,n);var o=new a.ARRAY_TYPE(3);return u.getTranslation(o,n),i(t,r,o),t},n.copy=s,n.identity=function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},n.set=function(t,n,r,a,e,u,o,i,s){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t[4]=u,t[5]=o,t[6]=i,t[7]=s,t},n.getDual=function(t,n){return t[0]=n[4],t[1]=n[5],t[2]=n[6],t[3]=n[7],t},n.setDual=function(t,n){return t[4]=n[0],t[5]=n[1],t[6]=n[2],t[7]=n[3],t},n.getTranslation=function(t,n){var r=n[4],a=n[5],e=n[6],u=n[7],o=-n[0],i=-n[1],s=-n[2],c=n[3];return t[0]=2*(r*c+u*o+a*s-e*i),t[1]=2*(a*c+u*i+e*o-r*s),t[2]=2*(e*c+u*s+r*i-a*o),t},n.translate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=.5*r[0],s=.5*r[1],c=.5*r[2],f=n[4],M=n[5],h=n[6],l=n[7];return t[0]=a,t[1]=e,t[2]=u,t[3]=o,t[4]=o*i+e*c-u*s+f,t[5]=o*s+u*i-a*c+M,t[6]=o*c+a*s-e*i+h,t[7]=-a*i-e*s-u*c+l,t},n.rotateX=function(t,n,r){var a=-n[0],u=-n[1],o=-n[2],i=n[3],s=n[4],c=n[5],f=n[6],M=n[7],h=s*i+M*a+c*o-f*u,l=c*i+M*u+f*a-s*o,v=f*i+M*o+s*u-c*a,d=M*i-s*a-c*u-f*o;return e.rotateX(t,n,r),a=t[0],u=t[1],o=t[2],i=t[3],t[4]=h*i+d*a+l*o-v*u,t[5]=l*i+d*u+v*a-h*o,t[6]=v*i+d*o+h*u-l*a,t[7]=d*i-h*a-l*u-v*o,t},n.rotateY=function(t,n,r){var a=-n[0],u=-n[1],o=-n[2],i=n[3],s=n[4],c=n[5],f=n[6],M=n[7],h=s*i+M*a+c*o-f*u,l=c*i+M*u+f*a-s*o,v=f*i+M*o+s*u-c*a,d=M*i-s*a-c*u-f*o;return e.rotateY(t,n,r),a=t[0],u=t[1],o=t[2],i=t[3],t[4]=h*i+d*a+l*o-v*u,t[5]=l*i+d*u+v*a-h*o,t[6]=v*i+d*o+h*u-l*a,t[7]=d*i-h*a-l*u-v*o,t},n.rotateZ=function(t,n,r){var a=-n[0],u=-n[1],o=-n[2],i=n[3],s=n[4],c=n[5],f=n[6],M=n[7],h=s*i+M*a+c*o-f*u,l=c*i+M*u+f*a-s*o,v=f*i+M*o+s*u-c*a,d=M*i-s*a-c*u-f*o;return e.rotateZ(t,n,r),a=t[0],u=t[1],o=t[2],i=t[3],t[4]=h*i+d*a+l*o-v*u,t[5]=l*i+d*u+v*a-h*o,t[6]=v*i+d*o+h*u-l*a,t[7]=d*i-h*a-l*u-v*o,t},n.rotateByQuatAppend=function(t,n,r){var a=r[0],e=r[1],u=r[2],o=r[3],i=n[0],s=n[1],c=n[2],f=n[3];return t[0]=i*o+f*a+s*u-c*e,t[1]=s*o+f*e+c*a-i*u,t[2]=c*o+f*u+i*e-s*a,t[3]=f*o-i*a-s*e-c*u,i=n[4],s=n[5],c=n[6],f=n[7],t[4]=i*o+f*a+s*u-c*e,t[5]=s*o+f*e+c*a-i*u,t[6]=c*o+f*u+i*e-s*a,t[7]=f*o-i*a-s*e-c*u,t},n.rotateByQuatPrepend=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=r[0],s=r[1],c=r[2],f=r[3];return t[0]=a*f+o*i+e*c-u*s,t[1]=e*f+o*s+u*i-a*c,t[2]=u*f+o*c+a*s-e*i,t[3]=o*f-a*i-e*s-u*c,i=r[4],s=r[5],c=r[6],f=r[7],t[4]=a*f+o*i+e*c-u*s,t[5]=e*f+o*s+u*i-a*c,t[6]=u*f+o*c+a*s-e*i,t[7]=o*f-a*i-e*s-u*c,t},n.rotateAroundAxis=function(t,n,r,e){if(Math.abs(e)<a.EPSILON)return s(t,n);var u=Math.sqrt(r[0]*r[0]+r[1]*r[1]+r[2]*r[2]);e*=.5;var o=Math.sin(e),i=o*r[0]/u,c=o*r[1]/u,f=o*r[2]/u,M=Math.cos(e),h=n[0],l=n[1],v=n[2],d=n[3];t[0]=h*M+d*i+l*f-v*c,t[1]=l*M+d*c+v*i-h*f,t[2]=v*M+d*f+h*c-l*i,t[3]=d*M-h*i-l*c-v*f;var b=n[4],m=n[5],p=n[6],P=n[7];return t[4]=b*M+P*i+m*f-p*c,t[5]=m*M+P*c+p*i-b*f,t[6]=p*M+P*f+b*c-m*i,t[7]=P*M-b*i-m*c-p*f,t},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t[4]=n[4]+r[4],t[5]=n[5]+r[5],t[6]=n[6]+r[6],t[7]=n[7]+r[7],t},n.multiply=c,n.scale=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=n[7]*r,t},n.lerp=function(t,n,r,a){var e=1-a;f(n,r)<0&&(a=-a);return t[0]=n[0]*e+r[0]*a,t[1]=n[1]*e+r[1]*a,t[2]=n[2]*e+r[2]*a,t[3]=n[3]*e+r[3]*a,t[4]=n[4]*e+r[4]*a,t[5]=n[5]*e+r[5]*a,t[6]=n[6]*e+r[6]*a,t[7]=n[7]*e+r[7]*a,t},n.invert=function(t,n){var r=h(n);return t[0]=-n[0]/r,t[1]=-n[1]/r,t[2]=-n[2]/r,t[3]=n[3]/r,t[4]=-n[4]/r,t[5]=-n[5]/r,t[6]=-n[6]/r,t[7]=n[7]/r,t},n.conjugate=function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t[4]=-n[4],t[5]=-n[5],t[6]=-n[6],t[7]=n[7],t},n.normalize=function(t,n){var r=h(n);if(r>0){r=Math.sqrt(r);var a=n[0]/r,e=n[1]/r,u=n[2]/r,o=n[3]/r,i=n[4],s=n[5],c=n[6],f=n[7],M=a*i+e*s+u*c+o*f;t[0]=a,t[1]=e,t[2]=u,t[3]=o,t[4]=(i-a*M)/r,t[5]=(s-e*M)/r,t[6]=(c-u*M)/r,t[7]=(f-o*M)/r}return t},n.str=function(t){return"quat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+")"},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=t[4],s=t[5],c=t[6],f=t[7],M=n[0],h=n[1],l=n[2],v=n[3],d=n[4],b=n[5],m=n[6],p=n[7];return Math.abs(r-M)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(M))&&Math.abs(e-h)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(h))&&Math.abs(u-l)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(l))&&Math.abs(o-v)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(v))&&Math.abs(i-d)<=a.EPSILON*Math.max(1,Math.abs(i),Math.abs(d))&&Math.abs(s-b)<=a.EPSILON*Math.max(1,Math.abs(s),Math.abs(b))&&Math.abs(c-m)<=a.EPSILON*Math.max(1,Math.abs(c),Math.abs(m))&&Math.abs(f-p)<=a.EPSILON*Math.max(1,Math.abs(f),Math.abs(p))};var a=o(r(0)),e=o(r(3)),u=o(r(4));function o(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}function i(t,n,r){var a=.5*r[0],e=.5*r[1],u=.5*r[2],o=n[0],i=n[1],s=n[2],c=n[3];return t[0]=o,t[1]=i,t[2]=s,t[3]=c,t[4]=a*c+e*s-u*i,t[5]=e*c+u*o-a*s,t[6]=u*c+a*i-e*o,t[7]=-a*o-e*i-u*s,t}function s(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t}n.getReal=e.copy;n.setReal=e.copy;function c(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=r[4],s=r[5],c=r[6],f=r[7],M=n[4],h=n[5],l=n[6],v=n[7],d=r[0],b=r[1],m=r[2],p=r[3];return t[0]=a*p+o*d+e*m-u*b,t[1]=e*p+o*b+u*d-a*m,t[2]=u*p+o*m+a*b-e*d,t[3]=o*p-a*d-e*b-u*m,t[4]=a*f+o*i+e*c-u*s+M*p+v*d+h*m-l*b,t[5]=e*f+o*s+u*i-a*c+h*p+v*b+l*d-M*m,t[6]=u*f+o*c+a*s-e*i+l*p+v*m+M*b-h*d,t[7]=o*f-a*i-e*s-u*c+v*p-M*d-h*b-l*m,t}n.mul=c;var f=n.dot=e.dot;var M=n.length=e.length,h=(n.len=M,n.squaredLength=e.squaredLength);n.sqrLen=h},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.sub=n.mul=void 0,n.create=function(){var t=new a.ARRAY_TYPE(6);a.ARRAY_TYPE!=Float32Array&&(t[1]=0,t[2]=0,t[4]=0,t[5]=0);return t[0]=1,t[3]=1,t},n.clone=function(t){var n=new a.ARRAY_TYPE(6);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t},n.identity=function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t},n.fromValues=function(t,n,r,e,u,o){var i=new a.ARRAY_TYPE(6);return i[0]=t,i[1]=n,i[2]=r,i[3]=e,i[4]=u,i[5]=o,i},n.set=function(t,n,r,a,e,u,o){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t[4]=u,t[5]=o,t},n.invert=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=n[4],i=n[5],s=r*u-a*e;if(!s)return null;return s=1/s,t[0]=u*s,t[1]=-a*s,t[2]=-e*s,t[3]=r*s,t[4]=(e*i-u*o)*s,t[5]=(a*o-r*i)*s,t},n.determinant=function(t){return t[0]*t[3]-t[1]*t[2]},n.multiply=e,n.rotate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=Math.sin(r),f=Math.cos(r);return t[0]=a*f+u*c,t[1]=e*f+o*c,t[2]=a*-c+u*f,t[3]=e*-c+o*f,t[4]=i,t[5]=s,t},n.scale=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=r[0],f=r[1];return t[0]=a*c,t[1]=e*c,t[2]=u*f,t[3]=o*f,t[4]=i,t[5]=s,t},n.translate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=r[0],f=r[1];return t[0]=a,t[1]=e,t[2]=u,t[3]=o,t[4]=a*c+u*f+i,t[5]=e*c+o*f+s,t},n.fromRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=a,t[1]=r,t[2]=-r,t[3]=a,t[4]=0,t[5]=0,t},n.fromScaling=function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t[4]=0,t[5]=0,t},n.fromTranslation=function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=n[0],t[5]=n[1],t},n.str=function(t){return"mat2d("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+")"},n.frob=function(t){return Math.sqrt(Math.pow(t[0],2)+Math.pow(t[1],2)+Math.pow(t[2],2)+Math.pow(t[3],2)+Math.pow(t[4],2)+Math.pow(t[5],2)+1)},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t[4]=n[4]+r[4],t[5]=n[5]+r[5],t},n.subtract=u,n.multiplyScalar=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*r,t[5]=n[5]*r,t},n.multiplyScalarAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t[3]=n[3]+r[3]*a,t[4]=n[4]+r[4]*a,t[5]=n[5]+r[5]*a,t},n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=t[4],s=t[5],c=n[0],f=n[1],M=n[2],h=n[3],l=n[4],v=n[5];return Math.abs(r-c)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(c))&&Math.abs(e-f)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(f))&&Math.abs(u-M)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(M))&&Math.abs(o-h)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(h))&&Math.abs(i-l)<=a.EPSILON*Math.max(1,Math.abs(i),Math.abs(l))&&Math.abs(s-v)<=a.EPSILON*Math.max(1,Math.abs(s),Math.abs(v))};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=r[0],f=r[1],M=r[2],h=r[3],l=r[4],v=r[5];return t[0]=a*c+u*f,t[1]=e*c+o*f,t[2]=a*M+u*h,t[3]=e*M+o*h,t[4]=a*l+u*v+i,t[5]=e*l+o*v+s,t}function u(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t[3]=n[3]-r[3],t[4]=n[4]-r[4],t[5]=n[5]-r[5],t}n.mul=e,n.sub=u},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.sub=n.mul=void 0,n.create=function(){var t=new a.ARRAY_TYPE(4);a.ARRAY_TYPE!=Float32Array&&(t[1]=0,t[2]=0);return t[0]=1,t[3]=1,t},n.clone=function(t){var n=new a.ARRAY_TYPE(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n},n.copy=function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t},n.identity=function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t},n.fromValues=function(t,n,r,e){var u=new a.ARRAY_TYPE(4);return u[0]=t,u[1]=n,u[2]=r,u[3]=e,u},n.set=function(t,n,r,a,e){return t[0]=n,t[1]=r,t[2]=a,t[3]=e,t},n.transpose=function(t,n){if(t===n){var r=n[1];t[1]=n[2],t[2]=r}else t[0]=n[0],t[1]=n[2],t[2]=n[1],t[3]=n[3];return t},n.invert=function(t,n){var r=n[0],a=n[1],e=n[2],u=n[3],o=r*u-e*a;if(!o)return null;return o=1/o,t[0]=u*o,t[1]=-a*o,t[2]=-e*o,t[3]=r*o,t},n.adjoint=function(t,n){var r=n[0];return t[0]=n[3],t[1]=-n[1],t[2]=-n[2],t[3]=r,t},n.determinant=function(t){return t[0]*t[3]-t[2]*t[1]},n.multiply=e,n.rotate=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=Math.sin(r),s=Math.cos(r);return t[0]=a*s+u*i,t[1]=e*s+o*i,t[2]=a*-i+u*s,t[3]=e*-i+o*s,t},n.scale=function(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=r[0],s=r[1];return t[0]=a*i,t[1]=e*i,t[2]=u*s,t[3]=o*s,t},n.fromRotation=function(t,n){var r=Math.sin(n),a=Math.cos(n);return t[0]=a,t[1]=r,t[2]=-r,t[3]=a,t},n.fromScaling=function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t},n.str=function(t){return"mat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},n.frob=function(t){return Math.sqrt(Math.pow(t[0],2)+Math.pow(t[1],2)+Math.pow(t[2],2)+Math.pow(t[3],2))},n.LDU=function(t,n,r,a){return t[2]=a[2]/a[0],r[0]=a[0],r[1]=a[1],r[3]=a[3]-t[2]*r[1],[t,n,r]},n.add=function(t,n,r){return t[0]=n[0]+r[0],t[1]=n[1]+r[1],t[2]=n[2]+r[2],t[3]=n[3]+r[3],t},n.subtract=u,n.exactEquals=function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]},n.equals=function(t,n){var r=t[0],e=t[1],u=t[2],o=t[3],i=n[0],s=n[1],c=n[2],f=n[3];return Math.abs(r-i)<=a.EPSILON*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(e-s)<=a.EPSILON*Math.max(1,Math.abs(e),Math.abs(s))&&Math.abs(u-c)<=a.EPSILON*Math.max(1,Math.abs(u),Math.abs(c))&&Math.abs(o-f)<=a.EPSILON*Math.max(1,Math.abs(o),Math.abs(f))},n.multiplyScalar=function(t,n,r){return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t},n.multiplyScalarAndAdd=function(t,n,r,a){return t[0]=n[0]+r[0]*a,t[1]=n[1]+r[1]*a,t[2]=n[2]+r[2]*a,t[3]=n[3]+r[3]*a,t};var a=function(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}(r(0));function e(t,n,r){var a=n[0],e=n[1],u=n[2],o=n[3],i=r[0],s=r[1],c=r[2],f=r[3];return t[0]=a*i+u*s,t[1]=e*i+o*s,t[2]=a*c+u*f,t[3]=e*c+o*f,t}function u(t,n,r){return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t[3]=n[3]-r[3],t}n.mul=e,n.sub=u},function(t,n,r){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.vec4=n.vec3=n.vec2=n.quat2=n.quat=n.mat4=n.mat3=n.mat2d=n.mat2=n.glMatrix=void 0;var a=l(r(0)),e=l(r(9)),u=l(r(8)),o=l(r(5)),i=l(r(4)),s=l(r(3)),c=l(r(7)),f=l(r(6)),M=l(r(2)),h=l(r(1));function l(t){if(t&&t.__esModule)return t;var n={};if(null!=t)for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(n[r]=t[r]);return n.default=t,n}n.glMatrix=a,n.mat2=e,n.mat2d=u,n.mat3=o,n.mat4=i,n.quat=s,n.quat2=c,n.vec2=f,n.vec3=M,n.vec4=h}])});
},{}],6:[function(require,module,exports){
module.exports = function(strings) {
  if (typeof strings === 'string') strings = [strings]
  var exprs = [].slice.call(arguments,1)
  var parts = []
  for (var i = 0; i < strings.length-1; i++) {
    parts.push(strings[i], exprs[i] || '')
  }
  parts.push(strings[i])
  return parts.join('')
}

},{}],7:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],8:[function(require,module,exports){
module.exports = require('./lib/EntityManager.js')

},{"./lib/EntityManager.js":10}],9:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
var util = require('util')

module.exports = Entity

util.inherits(Entity, EventEmitter)

/**
 * Basic component-driven object with facade functions for interacting with the
 * injected EntityManager object.
 * @constructor
 */
function Entity () {
  /**
   * Unique identifier.
   */
  this.id = nextId++

  /**
   * Ref to the manager for this facade, injected right after being
   * instantiated.
   * @private
   */
  this._manager = null

  /**
   * List of all the types of components on this entity.
   * @type {Array.<Function>}
   * @private
   */
  this._Components = []

  /**
   * All tags that this entity currently has.
   * @type {Array.<String>}
   * @private
   */
  this._tags = []

  // All entities are event emitters.
  EventEmitter.call(this)
}

/**
 * Re-init for pooling purposes.
 * @private
 */
Entity.prototype.__init = function () {
  this.id = nextId++
  this._manager = null
  this._Components.length = 0
  this._tags.length = 0
}

var nextId = 0

/**
 * @param {Function} TComponent
 * @return {Entity} This entity.
 */
Entity.prototype.addComponent = function (TComponent) {
  var args = Array.prototype.slice.call(arguments).slice(1)
  this._manager.entityAddComponent(this, TComponent, args)
  return this
}

/**
 * @param {Function} TComponent
 * @return {Entity} This entity.
 */
Entity.prototype.removeComponent = function (TComponent) {
  this._manager.entityRemoveComponent(this, TComponent)
  return this
}

/**
 * @param {Function} TComponent
 * @return {boolean} True if this entity has TComponent.
 */
Entity.prototype.hasComponent = function (TComponent) {
  return !!~this._Components.indexOf(TComponent)
}

/**
 * Drop all components.
 */
Entity.prototype.removeAllComponents = function () {
  return this._manager.entityRemoveAllComponents(this)
}

/**
 * @param {Array.<Function>} Components
 * @return {boolean} True if entity has all Components.
 */
Entity.prototype.hasAllComponents = function (Components) {
  var b = true

  for (var i = 0; i < Components.length; i++) {
    var C = Components[i]
    b &= !!~this._Components.indexOf(C)
  }

  return b
}

/**
 * @param {String} tag
 * @return {boolean} True if entity has tag.
 */
Entity.prototype.hasTag = function (tag) {
  return !!~this._tags.indexOf(tag)
}

/**
 * @param {String} tag
 * @return {Entity} This entity.
 */
Entity.prototype.addTag = function (tag) {
  this._manager.entityAddTag(this, tag)
  return this
}

/**
 * @param {String} tag
 * @return {Entity} This entity.
 */
Entity.prototype.removeTag = function (tag) {
  this._manager.entityRemoveTag(this, tag)
  return this
}

/**
 * Remove the entity.
 * @return {void}
 */
Entity.prototype.remove = function () {
  return this._manager.removeEntity(this)
}

},{"events":4,"util":21}],10:[function(require,module,exports){
module.exports = function (options) {
  return new EntityManager(options)
}

var Entity = require('./Entity.js')
var createPool = require('reuse-pool')
var getName = require('typedef').getName

/**
 * Manage, create, and destroy entities. Can use methods to mutate entities
 * (tags, components) directly or via the facade on the Entity.
 * @constructor
 */
function EntityManager (options = {}) {
  /**
   * Map of tags to the list of their entities.
   * @private
   */
  this._tags = {}

  /**
   * @type {Array.<Entity>}
   * @private
   */
  this._entities = []

  /**
   * @type {Array.<Group>}
   * @private
   */
  this._groups = {}

  /**
   * Pool entities.
   * @private
   */
  this._entityPool = createPool(function () { return new Entity() })

  /**
   * Map of component names to their respective object pools.
   * @private
   */
  this._componentPools = {}

  /**
   * Map of component groups to group keys.
   * @private
   */
  this._groupKeyMap = new WeakMap()

  /**
   * Provide options for backwards compatible support
   * @type {{camelCase: boolean}}
   * @private
   */
  this._options = Object.assign({}, {
    camelCase: true
  }, options)
}

/**
 * Used for indexing our component groups.
 * @constructor
 * @param {Array.<Function>} Components
 * @param {Array<Entity>} entities
 */
function Group (Components, entities) {
  this.Components = Components || []
  this.entities = entities || []
}

/**
 * Get a new entity.
 * @return {Entity}
 */
EntityManager.prototype.createEntity = function () {
  var entity = this._entityPool.get()

  this._entities.push(entity)
  entity._manager = this
  return entity
}

/**
 * Cleanly remove entities based on tag. Avoids loop issues.
 * @param {String} tag
 */
EntityManager.prototype.removeEntitiesByTag = function (tag) {
  var entities = this._tags[tag]

  if (!entities) return

  for (var x = entities.length - 1; x >= 0; x--) {
    var entity = entities[x]
    entity.remove()
  }
}

/**
 * Dump all entities out of the manager. Avoids loop issues.
 */
EntityManager.prototype.removeAllEntities = function () {
  for (var x = this._entities.length - 1; x >= 0; x--) {
    this._entities[x].remove()
  }
}

/**
 * Drop an entity. Returns it to the pool and fires all events for removing
 * components as well.
 * @param {Entity} entity
 */
EntityManager.prototype.removeEntity = function (entity) {
  var index = this._entities.indexOf(entity)

  if (!~index) {
    throw new Error('Tried to remove entity not in list')
  }

  this.entityRemoveAllComponents(entity)

  // Remove from entity list
  // entity.emit('removed')
  this._entities.splice(index, 1)

  // Remove entity from any tag groups and clear the on-entity ref
  entity._tags.length = 0
  for (var tag in this._tags) {
    var entities = this._tags[tag]
    var n = entities.indexOf(entity)
    if (~n) entities.splice(n, 1)
  }

  // Prevent any acecss and free
  entity._manager = null
  this._entityPool.recycle(entity)
  entity.removeAllListeners()
}

/**
 * @param {Entity} entity
 * @param {String} tag
 */
EntityManager.prototype.entityAddTag = function (entity, tag) {
  var entities = this._tags[tag]

  if (!entities) {
    entities = this._tags[tag] = []
  }

  // Don't add if already there
  if (~entities.indexOf(entity)) return

  // Add to our tag index AND the list on the entity
  entities.push(entity)
  entity._tags.push(tag)
}

/**
 * @param {Entity} entity
 * @param {String} tag
 */
EntityManager.prototype.entityRemoveTag = function (entity, tag) {
  var entities = this._tags[tag]
  if (!entities) return

  var index = entities.indexOf(entity)
  if (!~index) return

  // Remove from our index AND the list on the entity
  entities.splice(index, 1)
  entity._tags.splice(entity._tags.indexOf(tag), 1)
}

/**
 * @param {Entity} entity
 * @param {Function} Component
 */
EntityManager.prototype.entityAddComponent = function (entity, Component, args) {
  if (~entity._Components.indexOf(Component)) return

  entity._Components.push(Component)

  // Create the reference on the entity to this component
  var cName = componentPropertyName(Component, this._options.camelCase)

  args = args || []
  entity[cName] = new Component(entity, ...args)

  entity[cName].entity = entity

  // Check each indexed group to see if we need to add this entity to the list
  for (var groupName in this._groups) {
    var group = this._groups[groupName]

    // Only add this entity to a group index if this component is in the group,
    // this entity has all the components of the group, and its not already in
    // the index.
    if (!~group.Components.indexOf(Component)) {
      continue
    }
    if (!entity.hasAllComponents(group.Components)) {
      continue
    }
    if (~group.entities.indexOf(entity)) {
      continue
    }

    group.entities.push(entity)
  }

  entity.emit('component added', Component)
}

/**
 * Drop all components on an entity. Avoids loop issues.
 * @param {Entity} entity
 */
EntityManager.prototype.entityRemoveAllComponents = function (entity) {
  var Cs = entity._Components

  for (var j = Cs.length - 1; j >= 0; j--) {
    var C = Cs[j]
    entity.removeComponent(C)
  }
}

/**
 * @param {Entity} entity
 * @param {Function} Component
 */
EntityManager.prototype.entityRemoveComponent = function (entity, Component) {
  var index = entity._Components.indexOf(Component)
  if (!~index) return

  entity.emit('component removed', Component)

  // Check each indexed group to see if we need to remove it
  for (var groupName in this._groups) {
    var group = this._groups[groupName]

    if (!~group.Components.indexOf(Component)) {
      continue
    }
    if (!entity.hasAllComponents(group.Components)) {
      continue
    }

    var loc = group.entities.indexOf(entity)
    if (~loc) {
      group.entities.splice(loc, 1)
    }
  }

  // Remove T listing on entity and property ref, then free the component.
  var propName = componentPropertyName(Component, this._options.camelCase)
  entity._Components.splice(index, 1)
  delete entity[propName]
}

/**
 * Get a list of entities that have a certain set of components.
 * @param {Array.<Function>} Components
 * @return {Array.<Entity>}
 */
EntityManager.prototype.queryComponents = function (Components) {
  var group = this._groups[this._groupKey(Components)]

  if (!group) {
    group = this._indexGroup(Components)
  }

  return group.entities
}

/**
 * Get a list of entities that all have a certain tag.
 * @param {String} tag
 * @return {Array.<Entity>}
 */
EntityManager.prototype.queryTag = function (tag) {
  var entities = this._tags[tag]

  if (entities === undefined) {
    entities = this._tags[tag] = []
  }

  return entities
}

/**
 * @return {Number} Total number of entities.
 */
EntityManager.prototype.count = function () {
  return this._entities.length
}

/**
 * Create an index of entities with a set of components.
 * @param {Array.<Function>} Components
 * @private
 */
EntityManager.prototype._indexGroup = function (Components) {
  var key = this._groupKey(Components)

  if (this._groups[key]) return

  var group = this._groups[key] = new Group(Components)

  for (var n = 0; n < this._entities.length; n++) {
    var entity = this._entities[n]
    if (entity.hasAllComponents(Components)) {
      group.entities.push(entity)
    }
  }

  return group
}

/**
 * @param {Function} Component
 * @param {Boolean} camelCase whether to change casing of the name
 * @return {String}
 * @private
 */
function componentPropertyName (Component, camelCase = true) {
  var name = getName(Component)
  if (!name) {
    throw new Error('Component property name is empty, ' +
                    'try naming your component function')
  }
  if (!camelCase) {
    return name
  }
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/**
 * @param {Array.<Function>} Components
 * @return {String}
 * @private
 */
EntityManager.prototype._groupKey = function (Components) {
  var cachedKey = this._groupKeyMap.get(Components)
  if (cachedKey) {
    return cachedKey
  }

  var names = []
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n]
    names.push(getName(T))
  }

  var key = names
    .map(function (x) { return x.toLowerCase() })
    .sort()
    .join('-')

  this._groupKeyMap.set(Components, key)

  return key
}

},{"./Entity.js":9,"reuse-pool":13,"typedef":14}],11:[function(require,module,exports){
(function (Buffer){
'use strict';

/*
 * Buffer with a cursor and array extensions.
 */
var SolidCursor = require('cursor').extend({
  readFloatLEArray: function (length) {
    var value = new Float32Array(length);
    for (var i = 0; i < length; ++i) {
      value[i] = this.readFloatLE();
    }
    return value;
  },

  readInt32LEArray: function (length) {
    var value = new Int32Array(length);
    for (var i = 0; i < length; ++i) {
      value[i] = this.readInt32LE();
    }
    return value;
  }
});

/*
 * Neverball SOL loader.
 */
var Solid = module.exports = loadSol;

Solid.MAGIC = 0x4c4f53af;
Solid.VERSIONS = [7, 8];

/*
 * Material type flags.
 */
Solid.MTRL_LIT = (1 << 11);
Solid.MTRL_PARTICLE = (1 << 10);
Solid.MTRL_ALPHA_TEST = (1 << 9);
Solid.MTRL_REFLECTIVE = (1 << 8);
Solid.MTRL_TRANSPARENT = (1 << 7);
Solid.MTRL_SHADOWED = (1 << 6);
Solid.MTRL_DECAL = (1 << 5);
Solid.MTRL_ENVIRONMENT = (1 << 4);
Solid.MTRL_TWO_SIDED = (1 << 3);
Solid.MTRL_ADDITIVE = (1 << 2);
Solid.MTRL_CLAMP_S = (1 << 1);
Solid.MTRL_CLAMP_T = (1 << 0);

/*
 * Billboard flags.
 */
Solid.BILL_EDGE = 1;
Solid.BILL_FLAT = 2;
Solid.BILL_NOFACE = 4;

/*
 * Lump flags.
 */
Solid.LUMP_DETAIL = 1;

/*
 * Item types.
 */
Solid.ITEM_COIN = 1;
Solid.ITEM_GROW = 2;
Solid.ITEM_SHRINK = 3;

/*
 * Path flags.
 */
Solid.PATH_ORIENTED = 1;

/*
 * Load a SOL file from the given ArrayBuffer.
 */
function loadSol (buffer) {
  var stream = SolidCursor(buffer);

  var magic = stream.readInt32LE();

  if (magic !== Solid.MAGIC) {
    throw Error('Not a SOL file');
  }

  var version = stream.readInt32LE();

  if (!Solid.VERSIONS.includes(version)) {
    throw Error('SOL version ' + version + ' is not supported');
  }

  var ac = stream.readInt32LE();
  var dc = stream.readInt32LE();
  var mc = stream.readInt32LE();
  var vc = stream.readInt32LE();
  var ec = stream.readInt32LE();
  var sc = stream.readInt32LE();
  var tc = stream.readInt32LE();
  var oc = stream.readInt32LE();
  var gc = stream.readInt32LE();
  var lc = stream.readInt32LE();
  var nc = stream.readInt32LE();
  var pc = stream.readInt32LE();
  var bc = stream.readInt32LE();
  var hc = stream.readInt32LE();
  var zc = stream.readInt32LE();
  var jc = stream.readInt32LE();
  var xc = stream.readInt32LE();
  var rc = stream.readInt32LE();
  var uc = stream.readInt32LE();
  var wc = stream.readInt32LE();
  var ic = stream.readInt32LE();

  var sol = {};

  sol.version = version;

  sol.av = sol.bytes = Buffer.from(stream.slice(ac).buffer()); // Realloc.
  sol.dv = sol.dicts = loadDicts(stream, dc, sol.av);
  sol.mv = sol.mtrls = loadMtrls(stream, mc);
  sol.vv = sol.verts = loadVerts(stream, vc);
  sol.ev = sol.edges = loadEdges(stream, ec);
  sol.sv = sol.sides = loadSides(stream, sc);
  sol.tv = sol.texcs = loadTexcs(stream, tc);
  sol.ov = sol.offs = loadOffs(stream, oc);
  sol.gv = sol.geoms = loadGeoms(stream, gc);
  sol.lv = sol.lumps = loadLumps(stream, lc);
  sol.nv = sol.nodes = loadNodes(stream, nc);
  sol.pv = sol.paths = loadPaths(stream, pc);
  sol.bv = sol.bodies = loadBodies(stream, bc);
  sol.hv = sol.items = loadItems(stream, hc);
  sol.zv = sol.goals = loadGoals(stream, zc);
  sol.jv = sol.jumps = loadJumps(stream, jc);
  sol.xv = sol.switches = loadSwitches(stream, xc);
  sol.rv = sol.bills = loadBills(stream, rc);
  sol.uv = sol.balls = loadBalls(stream, uc);
  sol.wv = sol.views = loadViews(stream, wc);
  sol.iv = sol.indices = stream.readInt32LEArray(ic);

  if (sol.version <= 7) {
    var i;

    for (i = 0; i < sol.mv.length; ++i) {
      sol.mv[i].fl |= Solid.MTRL_LIT;
    }
    for (i = 0; i < sol.rv.length; ++i) {
      sol.mv[sol.rv[i].mi].fl &= ~Solid.MTRL_LIT;
    }
  }

  return sol;
}

function loadDicts (stream, count, byteBuffer) {
  var dicts = {};

  for (var i = 0; i < count; ++i) {
    var ai = stream.readInt32LE();
    var aj = stream.readInt32LE();

    var key = byteBuffer.toString('utf8', ai, byteBuffer.indexOf(0, ai));
    var val = byteBuffer.toString('utf8', aj, byteBuffer.indexOf(0, aj));

    if (key === 'message') {
      val = val.replace(/\\/g, '\n');
    }

    dicts[key] = val;
  }

  return dicts;
}

function loadMtrls (stream, count) {
  var mtrls = [];

  for (var i = 0; i < count; ++i) {
    var mtrl = {
      d: stream.readFloatLEArray(4),
      a: stream.readFloatLEArray(4),
      s: stream.readFloatLEArray(4),
      e: stream.readFloatLEArray(4),
      h: stream.readFloatLE(),
      fl: stream.readInt32LE()
    };

    var byteBuffer = stream.slice(64).buffer();
    mtrl.f = byteBuffer.toString('utf8', 0, byteBuffer.indexOf(0));

    if (mtrl.fl & Solid.MTRL_ALPHA_TEST) {
      mtrl.alphaFunc = stream.readInt32LE();
      mtrl.alphaRef = stream.readFloatLE();
    } else {
      mtrl.alphaFunc = 0;
      mtrl.alphaRef = 0.0;
    }

    mtrls.push(mtrl);
  }

  return mtrls;
}

function loadVerts (stream, count) {
  var verts = [];

  for (var i = 0; i < count; ++i) {
    verts.push(stream.readFloatLEArray(3));
  }

  return verts;
}

function loadEdges (stream, count) {
  var edges = [];

  for (var i = 0; i < count; ++i) {
    edges.push({
      vi: stream.readInt32LE(),
      vj: stream.readInt32LE()
    });
  }

  return edges;
}

function loadSides (stream, count) {
  var sides = [];

  for (var i = 0; i < count; ++i) {
    sides.push({
      n: stream.readFloatLEArray(3),
      d: stream.readFloatLE()
    });
  }

  return sides;
}

function loadTexcs (stream, count) {
  var texcs = [];

  for (var i = 0; i < count; ++i) {
    texcs.push(stream.readFloatLEArray(2));
  }

  return texcs;
}

function loadOffs (stream, count) {
  var offs = [];

  for (var i = 0; i < count; ++i) {
    offs.push({
      ti: stream.readInt32LE(),
      si: stream.readInt32LE(),
      vi: stream.readInt32LE()
    });
  }

  return offs;
}

function loadGeoms (stream, count) {
  var geoms = [];

  for (var i = 0; i < count; ++i) {
    geoms.push({
      mi: stream.readInt32LE(),
      oi: stream.readInt32LE(),
      oj: stream.readInt32LE(),
      ok: stream.readInt32LE()
    });
  }

  return geoms;
}

function loadLumps (stream, count) {
  var lumps = [];

  for (var i = 0; i < count; ++i) {
    lumps.push({
      fl: stream.readInt32LE(),
      v0: stream.readInt32LE(),
      vc: stream.readInt32LE(),
      e0: stream.readInt32LE(),
      ec: stream.readInt32LE(),
      g0: stream.readInt32LE(),
      gc: stream.readInt32LE(),
      s0: stream.readInt32LE(),
      sc: stream.readInt32LE()
    });
  }

  return lumps;
}

function loadNodes (stream, count) {
  var nodes = [];

  for (var i = 0; i < count; ++i) {
    nodes.push({
      si: stream.readInt32LE(),
      ni: stream.readInt32LE(),
      nj: stream.readInt32LE(),
      l0: stream.readInt32LE(),
      lc: stream.readInt32LE()
    });
  }

  return nodes;
}

function loadPaths (stream, count) {
  var paths = [];

  var i, path;

  for (i = 0, path; i < count; ++i) {
    path = {
      p: stream.readFloatLEArray(3),
      t: stream.readFloatLE(),
      pi: stream.readInt32LE(),
      f: stream.readInt32LE(),
      s: stream.readInt32LE(),
      fl: stream.readInt32LE()
    };

    if (path.fl & Solid.PATH_ORIENTED) {
      var e = stream.readFloatLEArray(4);

      // Convert Neverball's W X Y Z to glMatrix's X Y Z W.
      var w = e[0];

      e[0] = e[1];
      e[1] = e[2];
      e[2] = e[3];
      e[3] = w;

      // Orientation quaternion.
      path.e = e;
    } else {
      // Identity quaternion.
      path.e = new Float32Array([0, 0, 0, 1]);
    }

    paths.push(path);
  }

  // Turn into a linked list.
  for (i = 0, path; i < paths.length; ++i) {
    path = paths[i];
    // May link to itself.
    path.next = paths[path.pi] || null;
  }

  return paths;
}

function loadBodies (stream, count) {
  var bodies = [];

  for (var i = 0; i < count; ++i) {
    bodies.push({
      pi: stream.readInt32LE(),
      pj: stream.readInt32LE(),
      ni: stream.readInt32LE(),
      l0: stream.readInt32LE(),
      lc: stream.readInt32LE(),
      g0: stream.readInt32LE(),
      gc: stream.readInt32LE()
    });

    if (bodies[i].pj < 0) {
      bodies[i].pj = bodies[i].pi;
    }
  }

  return bodies;
}

function loadItems (stream, count) {
  var items = [];

  for (var i = 0; i < count; ++i) {
    items.push({
      p: stream.readFloatLEArray(3),
      t: stream.readInt32LE(),
      n: stream.readInt32LE()
    });
  }

  return items;
}

function loadGoals (stream, count) {
  var goals = [];

  for (var i = 0; i < count; ++i) {
    goals.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return goals;
}

function loadJumps (stream, count) {
  var jumps = [];

  for (var i = 0; i < count; ++i) {
    jumps.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return jumps;
}

function loadSwitches (stream, count) {
  var switches = [];

  for (var i = 0; i < count; ++i) {
    switches.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE(),
      pi: stream.readInt32LE(),
      t: stream.readFloatLEArray(2)[0], // Consume unused padding.
      f: stream.readFloatLEArray(2)[0], // Consume unused padding.
      i: stream.readInt32LE()
    });
  }

  return switches;
}

function loadBills (stream, count) {
  var bills = [];

  for (var i = 0; i < count; ++i) {
    bills.push({
      fl: stream.readInt32LE(),
      mi: stream.readInt32LE(),
      t: stream.readFloatLE(),
      d: stream.readFloatLE(),

      w: stream.readFloatLEArray(3),
      h: stream.readFloatLEArray(3),
      rx: stream.readFloatLEArray(3),
      ry: stream.readFloatLEArray(3),
      rz: stream.readFloatLEArray(3),
      p: stream.readFloatLEArray(3)
    });
  }

  return bills;
}

function loadBalls (stream, count) {
  var balls = [];

  for (var i = 0; i < count; ++i) {
    balls.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return balls;
}

function loadViews (stream, count) {
  var views = [];

  for (var i = 0; i < count; ++i) {
    views.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3)
    });
  }

  return views;
}
}).call(this,require("buffer").Buffer)
},{"buffer":2,"cursor":3}],12:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],13:[function(require,module,exports){
var EMPTY = {};
var NO_OP = function() {};

module.exports = reusePool;
function reusePool(factory, opts) {
    return new ReusePool(factory, opts);
}

function ReusePool(factory, opts) {
    this._factory = factory;
    this._recycled = [];
    opts = opts || EMPTY;
    this._prepare = opts.prepare || NO_OP;
    this._max = opts.max || Infinity;
}

ReusePool.prototype.get = function() {
    if (this._recycled.length) {
        var obj = this._recycled.pop();
        this._prepare(obj);
        return obj;
    } else {
        return this._factory();
    }
}

ReusePool.prototype.recycle = function(obj) {
	if (this._recycled.length < this._max) {
		this._recycled.push(obj);	
	}
}

},{}],14:[function(require,module,exports){
module.exports = {

  'extends'      : require('./lib/extends.js'),
  'mixin'        : require('./lib/mixin.js'),
  'getArguments' : require('./lib/getArguments.js'),
  'getName'      : require('./lib/getName.js')

};



},{"./lib/extends.js":15,"./lib/getArguments.js":16,"./lib/getName.js":17,"./lib/mixin.js":18}],15:[function(require,module,exports){
module.exports = extends_;

/**
 * The well documented, oft-used (Coffeescript, Typescript, ES6... etc) extends
 * pattern to get some sort of single-inheritance in Javascript.  Modify a
 * Child class to have inherited the static members via copying and link the
 * prototypes.
 * @param {Function} Child Child constructor function.
 * @param {Function} Parent Parent contrusctor function.
 * @return {Function} The Child constructor.
 */
function extends_(Child, Parent)
{
  // Drop in statics
  for (var key in Parent) {
    if (!Child.hasOwnProperty(key) && Parent.hasOwnProperty(key)) {
      Child[key] = Parent[key];
    }
  }

  // Give static to access parent
  Child.Super = Parent;

  // Child's prototype property is an object with the parent's prototype
  // property its [[prototype]] + constructor
  if (Object.create instanceof Function) {
    Child.prototype = Object.create(Parent.prototype, {
      constructor: { value: Child }
    });
  } else {
    // IE8 and below shim
    var T = makeT(Child);
    T.prototype = Parent.prototype;
    Child.prototype = new T();
  }

  return Child;
}

/**
 * @param {Function} Child
 * @return {Function}
 */
function makeT(Child)
{
  return function T() { this.constructor = Child; };
}


},{}],16:[function(require,module,exports){
module.exports = getArguments;

var FUNCTION_ARGS = /^\w*function[^\(]*\(([^\)]+)/;

/**
 * Get the parameter names of a function.
 * @param {Function} f A function.
 * @return {Array.<String>} An array of the argument names of a function.
 */
function getArguments(f)
{
  var ret = [];
  var args = f.toString().match(FUNCTION_ARGS);

  if (args) {
    args = args[1]
      .replace(/[ ]*,[ ]*/, ',')
      .split(',');
    for (var n = 0; n < args.length; n++) {
      var a = args[n].replace(/^\s+|\s+$/g, '');
      if (a) ret.push(a);
    }
  }

  return ret;
}


},{}],17:[function(require,module,exports){
module.exports = getName;

var FUNCTION_NAME = /function\s+([^\s(]+)/;

/**
 * Get the name of a function (e.g. constructor)
 * @param {Function} f
 * @return {String} The function name.
 */
function getName(f)
{
  var name = '';

  if (f instanceof Function) {
    if (f.name) {
      return f.name;
    }

    var match = f.toString().match(FUNCTION_NAME);

    if (match) {
      name = match[1];
    }
  } else if (f && f.constructor instanceof Function) {
    name = getName(f.constructor);
  }

  return name;
}

},{}],18:[function(require,module,exports){
module.exports = mixin_;

/**
 * Add all own properties of mixin to the prototype property of class T
 * @param {Function} T Class we want to mix into.
 * @param {Function|Object} mixin Mixin we want to mixt
 */
function mixin_(T, mixin)
{
  // If we're mixing in a class (constructor function), then first mix in all
  // things hanging directly off the mixin as "statics", then switch the mixin
  // ref to point to the prototype
  if (mixin instanceof Function) {
    for (var k in mixin) {
      T[k] = mixin[k];
    }
    mixin = mixin.prototype;
  }

  // Dump everything on the mixin into the prototype of our class
  for (var key in mixin) {
    if (mixin.hasOwnProperty(key)) {
      T.prototype[key] = mixin[key];
    }
  }
}


},{}],19:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],20:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],21:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":20,"_process":12,"inherits":19}],22:[function(require,module,exports){
'use strict';

var Mtrl = require('./mtrl.js');

module.exports = Batch;

/**
 * Batch is a fully specified draw call. That's it.
 */
function Batch() {
  if (!(this instanceof Batch)) {
    return new Batch();
  }

  // Texture/state
  this.mtrl = null;

  // Material pass index.
  this.passIndex = 0;

  // Shader program
  this.shader = null;

  // Vertex/element data
  this.meshData = null;

  // Location in the element array.
  this.elemBase = 0;
  this.elemCount = 0;

  // Value passed to DrawElementsInstanced.
  this.instanceCount = 0;

  // Batch sort order/draw order.
  this.sortBits = 0;
}

Batch.prototype.draw = function (state) {
  var gl = state.gl;

  var batch = this;
  var mtrl = batch.mtrl;
  var shader = batch.shader;
  var meshData = batch.meshData;
  var count = batch.instanceCount;

  // Bind vertex array object.
  meshData.bindVertexArray(state);

  // Apply material state.
  mtrl.apply(state, this.passIndex);

  // Bind shader.
  shader.use(state);

  // Update shader globals.
  shader.uploadUniforms(state);

  // PSA: glDrawElements offset is in bytes.
  state.drawElementsInstanced(gl.TRIANGLES, batch.elemCount, gl.UNSIGNED_SHORT, batch.elemBase * 2, count);

  state.bindVertexArray(null);
};

/*
 * 1111 1111 1111 1111
 * ^ ^^
 * | ||
 * | | `- Decal (1 bit)
 * |  `- Blend (1 bit)
 *  `-- Layer (2 bits)
 */

Batch._MAX_SORT_BITS = 16;

Batch.LAYER_GRADIENT = 0;
Batch.LAYER_BACKGROUND = 1;
Batch.LAYER_FOREGROUND = 2;

Batch.BLEND_OPAQUE = 0;
Batch.BLEND_TRANSPARENT = 1;

Batch.prototype.defaultSortBits = function () {
  var batch = this;
  var mtrl = batch.mtrl;
  var flags = mtrl.flagsPerPass[this.passIndex];

  this.setSortLayer(Batch.LAYER_FOREGROUND);
  this.setSortBlend((flags & Mtrl.DEPTH_WRITE) ? Batch.BLEND_OPAQUE : Batch.BLEND_TRANSPARENT);
  this.setSortDecal(!!(flags & Mtrl.POLYGON_OFFSET));
};

Batch.prototype._setSortBits = function (firstBit, bitLength, value) {
  const MAX_BITS = Batch._MAX_SORT_BITS;

  if (firstBit < 0 || firstBit >= MAX_BITS) {
    throw new Error('Invalid first bit');
  }

  if (bitLength < 1 || firstBit + bitLength > MAX_BITS) {
    throw new Error('Invalid bit length');
  }

  var bitShift = MAX_BITS - (firstBit + bitLength);
  var bitMask = Math.pow(2, bitLength) - 1;

  this.sortBits = (this.sortBits & ~(bitMask << bitShift)) | (value & bitMask) << bitShift;
}

Batch.prototype.setSortLayer = function (layer) {
  this._setSortBits(0, 2, layer);
};

Batch.prototype.setSortBlend = function (blend) {
  this._setSortBits(2, 1, blend);
};

Batch.prototype.setSortDecal = function (decal) {
  this._setSortBits(3, 1, decal ? 0 : 1);
}

Batch.prototype.setSortExceptLayer = function (value) {
  this._setSortBits(2, Batch._MAX_SORT_BITS - 2, value);
};

function compareBatches(batch0, batch1) {
  if (batch0.instanceCount === 0) {
    return +1;
  }
  if (batch1.instanceCount === 0) {
    return -1;
  }

  var a = batch0.sortBits;
  var b = batch1.sortBits;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }

  // Work around unstable sort on Chrome.

  a = batch0.mtrl.id;
  b = batch1.mtrl.id;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }
  return 0;
};

Batch.sortBatches = function (batches) {
  batches.sort(compareBatches);
};
},{"./mtrl.js":33}],23:[function(require,module,exports){
'use strict';

var SceneNode = require('./scene-node.js');
var Batch = require('./batch.js');
var MeshData = require('./mesh-data.js');
var Solid = require('./solid.js');

module.exports = BodyModel;

var _modelIndex = 0;

/**
 * BodyModel is vertex data + a bunch of draw calls (batches) + transform matrices (scene node).
 */
function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  // Globally unique name for this model.
  this.id = 'default_' + (_modelIndex++).toString();

  // Also known as draw calls.
  this.batches = null;

  // Also known as a vertex array object.
  this.meshData = MeshData();

  // Model-view matrices are managed by the scene graph.
  // We can set a parent node on this scene-node.
  // We can also create instances of this scene-node and
  // set parents on those instead.
  this.sceneNode = SceneNode();
}

BodyModel.prototype.getInstances = function () {
  return this.sceneNode.instances;
};

BodyModel.prototype.attachInstance = function (parent) {
  var instance = this.sceneNode.createInstance();
  instance.setParent(parent);
  return instance;
}

BodyModel.prototype.getInstanceMatrices = function (viewMatrix = null) {
  return this.sceneNode.getInstanceMatrices(viewMatrix);
};

BodyModel.getIdFromSolBody = function (sol, bodyIndex) {
  return 'BodyModel:' + sol.id + '#' + bodyIndex.toString();
};

BodyModel.fromSolBody = function (sol, bodyIndex) {
  var solBody = sol.bodies[bodyIndex];
  var model = BodyModel();

  model.id = BodyModel.getIdFromSolBody(sol, bodyIndex);

  model.getBatchesFromSol(sol, solBody);

  return model;
};

BodyModel.getIdFromSolBill = function (sol, billIndex) {
  var solBill = sol.bills[billIndex];

  return 'BillModel:' + ((solBill.fl & Solid.BILL_EDGE) ? 'edge__' : '') + sol.mtrls[solBill.mi].f;
}

BodyModel.fromSolBill = function (sol, billIndex) {
  const stride = 8;

  var bill = sol.rv[billIndex];

  var model = BodyModel();

  model.sceneNode._id = sol.id + ' bill_' + billIndex;

  model.id = BodyModel.getIdFromSolBill(sol, billIndex);

  var meshData = model.meshData;
  var verts = meshData.verts = new Float32Array(4 * stride); // 4 vertices
  var elems = meshData.elems = new Uint16Array(2 * 3); // 2 triangles
  var batches = model.batches = [];

  function addBillVert (i, x, y, s, t) {
    // position
    verts[i * stride + 0] = x;
    verts[i * stride + 1] = y;
    verts[i * stride + 2] = 0.0;
    // normal
    verts[i * stride + 3] = 0.0;
    verts[i * stride + 4] = 0.0;
    verts[i * stride + 5] = 1.0;
    // texcoords
    verts[i * stride + 6] = s;
    verts[i * stride + 7] = t;
  }

  // TODO
  // BILL_EDGE
  if (bill.fl & 0x1) {
    addBillVert(0, -0.5, 0.0, 0.0, 0.0);
    addBillVert(1, +0.5, 0.0, 1.0, 0.0);
    addBillVert(2, -0.5, 1.0, 0.0, 1.0);
    addBillVert(3, +0.5, 1.0, 1.0, 1.0);
  } else {
    addBillVert(0, -0.5, -0.5, 0.0, 0.0);
    addBillVert(1, +0.5, -0.5, 1.0, 0.0);
    addBillVert(2, -0.5, +0.5, 0.0, 1.0);
    addBillVert(3, +0.5, +0.5, 1.0, 1.0);
  }

  // GL_TRIANGLES

  elems[0] = 0;
  elems[1] = 1;
  elems[2] = 2;

  elems[3] = 1;
  elems[4] = 3;
  elems[5] = 2;

  // TODO create/get batch for billboard

  var batch = Batch();

  batch.mtrl = sol._materials[bill.mi];
  batch.shader = sol._shaders[bill.mi];
  batch.meshData = meshData;
  batch.elemBase = 0;
  batch.elemCount = 6;

  // Sort background billboards by order of appearance, and nothing else.
  if (bill.fl & Solid.BILL_BACK) {
    batch.setSortLayer(Batch.LAYER_BACKGROUND);
    batch.setSortExceptLayer(billIndex);
  } else {
    batch.defaultSortBits();
  }

  batches.push(batch);

  return model;
};

// TODO This is just a proxy, get rid of it.
BodyModel.prototype.createObjects = function (state) {
  var meshData = this.meshData;
  meshData.createObjects(state);
};

BodyModel.prototype.uploadModelViewMatrices = function (state, viewMatrix = null) {
  var model = this;
  var meshData = this.meshData;
  var gl = state.gl;

  if (!meshData.instanceVBO) {
    return;
  }

  var matrices = model.getInstanceMatrices(viewMatrix);

  if (matrices.length) {
    gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
  }
}

/**
 * Sort a geom (triangle) into the appropriate material bucket.
 */
function addGeomByMtrl (geoms, geom) {
  var mi = geom.mi;

  if (geoms[mi]) {
    geoms[mi].push(geom);
  } else {
    geoms[mi] = [geom];
  }
}

/**
 * Sort body geoms (triangles) into per-material buckets.
 */
function getBodyGeomsByMtrl (sol, body) {
  var geoms = Array(sol.mtrls.length);

  var li, gi;

  // OBJ geometry.
  for (gi = 0; gi < body.gc; ++gi) {
    addGeomByMtrl(geoms, sol.gv[sol.iv[body.g0 + gi]]);
  }

  // Lump geometry.
  for (li = 0; li < body.lc; ++li) {
    var lump = sol.lv[body.l0 + li];

    for (gi = 0; gi < lump.gc; ++gi) {
      addGeomByMtrl(geoms, sol.gv[sol.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
}

/**
 * Collect interleaved vertex attributes from SOL data structures.
 */
function getVertAttribs (verts, pos, sol, offs) {
  var p = sol.vv[offs.vi];
  var n = sol.sv[offs.si].n;
  var t = sol.tv[offs.ti];

  verts[pos + 0] = p[0];
  verts[pos + 1] = p[1];
  verts[pos + 2] = p[2];

  verts[pos + 3] = n[0];
  verts[pos + 4] = n[1];
  verts[pos + 5] = n[2];

  verts[pos + 6] = t[0];
  verts[pos + 7] = t[1];
}

/**
 * Create batches for a SOL body, one batch per material.
 */
BodyModel.prototype.getBatchesFromSol = function (sol, body) {
  var model = this;

  const stride = (3 + 3 + 2); // p + n + t

  var geomsByMtrl = getBodyGeomsByMtrl(sol, body);
  var geomsTotal = geomsByMtrl.reduce((total, geoms) => (total + geoms.length), 0);

  // Vertex store.
  var verts = new Float32Array(geomsTotal * 3 * stride);
  // Added vertices.
  var vertsTotal = 0;

  // Element store.
  var elems = new Uint16Array(geomsTotal * 3);
  // Added elements.
  var elemsTotal = 0;

  var meshData = model.meshData;
  var batches = [];

  // Add a single SOL vertex to the vertex store.
  function addVert (sol, offs) {
    var pos = vertsTotal * stride;
    getVertAttribs(verts, pos, sol, offs);
    vertsTotal++;
  }

  // Create a batch (draw call) for each material, using forEach to iterate over a sparse array.
  geomsByMtrl.forEach(function (geoms, mi) {
    var mtrl = sol._materials[mi];
    var shader = sol._shaders[mi];

    var batch = Batch();

    batch.mtrl = mtrl;
    batch.shader = shader;
    batch.meshData = meshData;
    batch.elemBase = elemsTotal;
    batch.elemCount = 0;

    batch.defaultSortBits();

    var offsToVert = [];

    for (var i = 0; i < geoms.length; ++i) {
      var geom = geoms[i];

      if (offsToVert[geom.oi] === undefined) {
        offsToVert[geom.oi] = vertsTotal;
        addVert(sol, sol.ov[geom.oi]);
      }

      if (offsToVert[geom.oj] === undefined) {
        offsToVert[geom.oj] = vertsTotal;
        addVert(sol, sol.ov[geom.oj]);
      }

      if (offsToVert[geom.ok] === undefined) {
        offsToVert[geom.ok] = vertsTotal;
        addVert(sol, sol.ov[geom.ok]);
      }

      elems[batch.elemBase + i * 3 + 0] = offsToVert[geom.oi];
      elems[batch.elemBase + i * 3 + 1] = offsToVert[geom.oj];
      elems[batch.elemBase + i * 3 + 2] = offsToVert[geom.ok];

      elemsTotal += 3;
    }

    batch.elemCount = elemsTotal - batch.elemBase;

    batches.push(batch);

    // Insert additional draw calls for multi-pass rendering.

    for (var passIndex = 1, passCount = mtrl.flagsPerPass.length; passIndex < passCount; ++passIndex) {
      // Copy batch, but set a different pass index.

      var extraBatch = Batch();
      Object.assign(extraBatch, batch);
      extraBatch.passIndex = passIndex;

      batches.push(extraBatch);
    }
  });

  meshData.verts = verts.slice(0, vertsTotal * stride);
  meshData.elems = elems;

  model.meshData = meshData;
  model.batches = batches;
};

},{"./batch.js":22,"./mesh-data.js":30,"./scene-node.js":34,"./solid.js":38}],24:[function(require,module,exports){
var Solid = require('./solid.js');
var mtrlImages = require('./mtrl-images.json');

var data = module.exports;

function _fetchBinaryFile(path) {
  return new Promise(function (resolve, reject) {
    var req = new window.XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.onload = function () {
      if (req.status === 200) {
        resolve(req.response);
      }
    };
    req.open('GET', 'data/' + path);
    req.send();
  });
};

data.fetchImage = function (path) {
  return new Promise(function (resolve, reject) {
    var img = new window.Image();
    img.onload = function () {
      resolve(img);
    };
    img.src = 'data/' + path;
  });
};

data.fetchSol = function (path) {
  return _fetchBinaryFile(path).then(function (buffer) {
    var sol = Solid(buffer);
    sol.id = path;
    return sol;
  });
};

data.fetchImageForMtrl = function (mtrl) {
  var imagePath = mtrlImages[mtrl.name];

  if (imagePath) {
    return data.fetchImage(imagePath);
  } else {
    return Promise.reject(Error('Material image for ' + mtrl.name + ' is unknown'));
  }
}

data.loadFile = function (file) {
  return new Promise(function (resolve, reject) {
    var reader = new window.FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.readAsArrayBuffer(file);
  });
};

data.loadSolid = function (file) {
  return data.loadFile(file).then(Solid);
};
},{"./mtrl-images.json":32,"./solid.js":38}],25:[function(require,module,exports){
'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat3 = require('gl-matrix').mat3;

var Solid = require('./solid.js');
var SceneNode = require('./scene-node.js');
var Mover = require('./mover.js');

var EC = module.exports = {};

/*
 * By nano-ECS convention, the function name defines the component name.
 *   componentRef = function componentName () { ... }
 */

/*
 * Scene graph node.
 */
EC.SceneGraph = function sceneGraph () {
  this.node = SceneNode();
};

EC.SceneGraph.prototype.setParent = function (node) {
  this.node.setParent(node);
};

EC.SceneGraph.prototype.setLocalMatrix = function (p, e, s) {
  var node = this.node;

  if (node) {
    node.setLocalMatrix(p, e, s);
  }
};

/**
 * Model data.
 */
EC.SceneModel = function sceneModel () {
  this.slot = '';
}

EC.SceneModel.prototype.setSlot = function (modelSlot) {
  if (this.slot) {
    this.entity.removeTag(this.slot);
  }

  this.slot = modelSlot;

  this.entity.addTag(modelSlot);

  // TODO: what if this entity already had a model attached to it?
  // TODO: updateSystems() will have to handle it.
  this.entity.addTag('needsModel');
}

/*
 * Spatial transform
 */
EC.Spatial = function spatial () {
  this.position = vec3.create();
  this.orientation = quat.create();
  this.scale = 1;

  // TODO
  this.dirty = true;
};

/*
 * Path walkers
 */
EC.Movers = function movers () {
  this.translate = null;
  this.rotate = null;
};

EC.Movers.prototype.fromSolBody = function (sol, solBody) {
  var movers = Mover.fromSolBody(sol, solBody);

  this.translate = movers.translate;
  this.rotate = movers.rotate;
};

/*
 * Item
 */
EC.Item = function item () {
  this.value = 0;
};

/*
 * Color
 */
EC.Color = function color () {
  this.color = [1.0, 1.0, 1.0, 1.0];
};

/*
 * Billboard
 */
EC.Billboard = function billboard () {
  this.time = 1.0;
  this.dist = 0.0;

  this.w = vec3.create();
  this.h = vec3.create();

  this.rx = vec3.create();
  this.ry = vec3.create();
  this.rz = vec3.create();

  this.flags = 0;
};

EC.Billboard.prototype.fromSolBill = function (sol, solBill) {
  this.time = solBill.t;
  this.dist = solBill.d;

  this.w = solBill.w;
  this.h = solBill.h;

  this.rx = solBill.rx;
  this.ry = solBill.ry;
  this.rz = solBill.rz;

  this.flags = solBill.fl;
};

EC.Billboard.prototype.getTransform = function (out_position, out_orientation, out_scale, scene) {
  if (this.flags & Solid.BILL_BACK) {
    this.getBackgroundTransform(out_position, out_orientation, out_scale, scene);
  } else {
    this.getForegroundTransform(out_orientation, out_scale, scene);
  }
}

EC.Billboard.prototype.getForegroundTransform = (function () {
  var Q = quat.create();
  var M = mat3.create();

  return function (out_orientation, out_scale, scene) {
    // sol_bill

    var T = this.time * scene.time;
    var S = Math.sin(T);

    var w = this.w[0] + this.w[1] * T + this.w[2] * S;
    var h = this.h[0] + this.h[1] * T + this.h[2] * S;

    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * S;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * S;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * S;

    if ((this.flags & Solid.BILL_NOFACE)) {
      quat.identity(Q);
    } else {
      mat3.fromMat4(M, scene.view.getBasis());
      quat.fromMat3(Q, M);
      quat.normalize(Q, Q);
    }

    if (rx) quat.rotateX(Q, Q, rx * Math.PI / 180.0);
    if (ry) quat.rotateY(Q, Q, ry * Math.PI / 180.0);
    if (rz) quat.rotateZ(Q, Q, rz * Math.PI / 180.0);

    quat.copy(out_orientation, Q);
    vec3.set(out_scale, w, h, 1.0);
  };
})();

EC.Billboard.prototype.getBackgroundTransform = (function () {
  var P = vec3.create();
  var Q = quat.create();

  return function (out_position, out_orientation, out_scale, scene) {
    var T = this.time > 0.0 ? (scene.time % this.time) - (this.time / 2.0) : 0.0;

    var w = this.w[0] + this.w[1] * T + this.w[2] * T * T;
    var h = this.h[0] + this.h[1] * T + this.h[2] * T * T;

    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * T * T;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * T * T;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * T * T;

    quat.identity(Q);

    if (ry) quat.rotateY(Q, Q, ry * Math.PI / 180.0);
    if (rx) quat.rotateX(Q, Q, rx * Math.PI / 180.0);

    vec3.set(P, 0, 0, -this.dist);
    vec3.transformQuat(P, P, Q);

    if (this.flags & Solid.BILL_FLAT) {
      quat.rotateX(Q, Q, (-rx - 90.0) * Math.PI / 180.0);
      quat.rotateZ(Q, Q, -ry * Math.PI / 180.0);
    }

    if (this.flags & Solid.BILL_EDGE) {
      quat.rotateX(Q, Q, -rx * Math.PI / 180.0);
    }

    if (rz) quat.rotateZ(Q, Q, rz * Math.PI / 180.0);

    vec3.copy(out_position, P);
    quat.copy(out_orientation, Q);
    vec3.set(out_scale, w, h, 1.0);
  };
})();

},{"./mover.js":31,"./scene-node.js":34,"./solid.js":38,"gl-matrix":5}],26:[function(require,module,exports){
'use strict';

var EventEmitter = require('events');

var Mtrl = require('./mtrl.js');
var Shader = require('./shader.js');
var BodyModel = require('./body-model.js');

module.exports = GLPool;

/**
 * Keep track of allocated GL resources.
 *
 * There are three types of resources:
 *
 * 1) materials (textures)
 * 2) shaders (programs)
 * 3) models (VBOs and VAOs)
 *
 * Cache a SOL's resources with pool.cacheSol(sol).
 *
 * pool.emitter is an EventEmitter that emits 'mtrl', 'shader', 'model'
 * events for each cached resource.
 */
function GLPool () {
  if (!(this instanceof GLPool)) {
    return new GLPool();
  }

  this.emitter = new EventEmitter();

  this.materials = makeCache(Object.create(null)); // Keyed by name (string).
  this.shaders = makeCache([]); // Keyed by flags (integer).
  this.models = makeCache(Object.create(null)); // Keyed by id (string).
  this.meshData = makeCache(Object.create(null)); // Keyed by id (string).
}

function makeCache (store) {
  return {
    store: store,

    set: function (key, obj) {
      this.store[key] = obj;
    },

    get: function (key) {
      return this.store[key];
    }
  };
}

GLPool.prototype._getMtrl = function (name) {
  return this.materials.get(name);
};

GLPool.prototype._getShader = function (flags) {
  return this.shaders.get(flags);
};

GLPool.prototype._getModel = function (id) {
  return this.models.get(id);
};

GLPool.prototype._getMeshData = function (id) {
  return this.meshData.get(id);
}

GLPool.prototype._cacheMtrl = function (mtrl) {
  var pool = this;

  this.materials.set(mtrl.name, mtrl);

  mtrl.fetchImage().then(function () {
    pool.emitter.emit('mtrl', mtrl);
  })
};

GLPool.prototype._cacheShader = function (shader) {
  this.shaders.set(shader.flags, shader);
  this.emitter.emit('shader', shader);
};

GLPool.prototype._cacheModel = function (model) {
  this.models.set(model.id, model);
  this.emitter.emit('model', model);
};

GLPool.prototype._cacheMeshData = function (meshData) {
  this.meshData.set(meshData.id, meshData);
  this.emitter.emit('meshdata', meshData);
}

/**
 * Cache materials and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheMtrlsFromSol = function (sol) {
  var pool = this;

  sol._materials = Array(sol.mtrls.length);

  for (var mi = 0; mi < sol.mtrls.length; ++mi) {
    var solMtrl = sol.mtrls[mi];
    var mtrl = pool._getMtrl(solMtrl.f);

    if (!mtrl) {
      mtrl = Mtrl.fromSolMtrl(sol, mi);
      pool._cacheMtrl(mtrl);
    }

    sol._materials[mi] = mtrl;
  }
};

/**
 * Cache models and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheModelsFromSol = function (sol) {
  var pool = this;

  sol._models = Array(sol.bodies.length);

  for (var bi = 0; bi < sol.bodies.length; ++bi) {
    var id = BodyModel.getIdFromSolBody(sol, bi);
    var model = pool._getModel(id);

    if (!model) {
      model = BodyModel.fromSolBody(sol, bi);
      pool._cacheModel(model);
    }

    sol._models[bi] = model;
  }

  // TODO
  sol._billboardModels = Array(sol.bills.length);

  for (var i = 0, n = sol.bills.length; i < n; ++i) {
    var id = BodyModel.getIdFromSolBill(sol, i);
    var model = pool._getModel(id);

    if (!model) {
      model = BodyModel.fromSolBill(sol, i);
      pool._cacheModel(model);
    }
    sol._billboardModels[i] = model;
  }
};

/**
 * Cache shaders and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheShadersFromSol = function (sol) {
  var pool = this;

  sol._shaders = Array(sol.mtrls.length);

  for (var mi = 0; mi < sol.mtrls.length; ++mi) {
    var solMtrl = sol.mtrls[mi];
    var flags = Shader.getFlagsFromSolMtrl(solMtrl);
    var shader = pool._getShader(flags);

    if (!shader) {
      shader = Shader.fromSolMtrl(solMtrl);
      pool._cacheShader(shader);
    }

    sol._shaders[mi] = shader;
  }
};

/**
 * Cache resources from the SOL.
 */
GLPool.prototype.cacheSol = function (sol) {
  this.cacheShadersFromSol(sol);
  this.cacheMtrlsFromSol(sol);
  this.cacheModelsFromSol(sol);
};

},{"./body-model.js":23,"./mtrl.js":33,"./shader.js":36,"events":4}],27:[function(require,module,exports){
'use strict';

var Uniform = require('./uniform.js');

module.exports = GLState;

function GLState(canvas) {
  if (!(this instanceof GLState)) {
    return new GLState(canvas);
  }

  this.defaultTexture = null;
  this.enableTextures = true;

  this.vertexAttrs = {
    Position: 0,
    Normal: 1,
    TexCoord: 2,
    ModelViewMatrix: 3 // and 4, 5, 6. Maximum is 8 attribute locations.
  };

  this.boundTextures = [];
  this.enabledCapabilities = [];

  var gl = this.gl = getContext(canvas);

  setupContext(this.gl);

  this.shadowState = {
    currentProgram: gl.getParameter(gl.CURRENT_PROGRAM),
    blendSrcRGB: gl.getParameter(gl.BLEND_SRC_RGB),
    blendDstRGB: gl.getParameter(gl.BLEND_DST_RGB),
    depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),
    cullFaceMode: gl.getParameter(gl.CULL_FACE_MODE),
    polygonOffsetFactor: gl.getParameter(gl.POLYGON_OFFSET_FACTOR),
    polygonOffsetUnits: gl.getParameter(gl.POLYGON_OFFSET_UNITS)
  };

  this.instancedArrays = this.gl.getExtension('ANGLE_instanced_arrays');
  this.vertexArrayObject = this.gl.getExtension('OES_vertex_array_object');

  // TODO
  this.uniforms = {
    uTexture: Uniform.i(),
    ProjectionMatrix: Uniform.mat4(),
    ViewMatrix: Uniform.mat4(),
    uDiffuse: Uniform.vec4(),
    uAmbient: Uniform.vec4(),
    uSpecular: Uniform.vec4(),
    uEmissive: Uniform.vec4(),
    uShininess: Uniform.f(),
    uEnvironment: Uniform.i()
  };

  this.createDefaultObjects();
}

GLState.prototype.cullFace = function (mode) {
  if (this.shadowState.cullFaceMode !== mode) {
    this.gl.cullFace(mode);
    this.shadowState.cullFaceMode = mode;
  }
}

GLState.prototype.depthMask = function (mask) {
  if (this.shadowState.depthMask !== mask) {
    this.gl.depthMask(mask);
    this.shadowState.depthMask = mask;
  }
};

GLState.prototype.bindTexture = function (target, texture) {
  if (this.boundTextures[target] !== texture) {
    this.gl.bindTexture(target, texture);
    this.boundTextures[target] = texture;
  }
};

GLState.prototype.useProgram = function (program) {
  if (this.shadowState.currentProgram !== program) {
    this.gl.useProgram(program);
    this.shadowState.currentProgram = program;
  }
};

GLState.prototype.enable = function (cap) {
  if (this.enabledCapabilities[cap] !== true) {
    this.gl.enable(cap);
    this.enabledCapabilities[cap] = true;
  }
};

GLState.prototype.disable = function (cap) {
  if (this.enabledCapabilities[cap] !== false) {
    this.gl.disable(cap);
    this.enabledCapabilities[cap] = false;
  }
};

GLState.prototype.blendFunc = function (src, dst) {
  if (this.shadowState.blendSrcRGB !== src || this.shadowState.blendDstRGB !== dst) {
    this.gl.blendFunc(src, dst);
    this.shadowState.blendSrcRGB = src;
    this.shadowState.blendDstRGB = dst;
  }
}

GLState.prototype.polygonOffset = function (factor, units) {
  if (this.shadowState.polygonOffsetFactor !== factor || this.shadowState.polygonOffsetUnits !== units) {
    this.gl.polygonOffset(factor, units);
    this.shadowState.polygonOffsetFactor = factor;
    this.shadowState.polygonOffsetUnits = units;
  }
}

GLState.prototype.createVertexArray = function () {
  return this.vertexArrayObject.createVertexArrayOES();
};

GLState.prototype.bindVertexArray = function (vao) {
  this.vertexArrayObject.bindVertexArrayOES(vao);
};

GLState.prototype.vertexAttribDivisor = function (index, divisor) {
  this.instancedArrays.vertexAttribDivisorANGLE(index, divisor);
};

GLState.prototype.drawElementsInstanced = function (mode, count, type, offset, primcount) {
  this.instancedArrays.drawElementsInstancedANGLE(mode, count, type, offset, primcount);
};

/*
 * Obtain a WebGL context. Now IE compatible, whoo.
 */
function getContext(canvas) {
  var opts = { depth: true, alpha: false };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  return gl;
}

function setupContext(gl) {
  // Straight alpha vs premultiplied alpha:
  // https://limnu.com/webgl-blending-youre-probably-wrong/
  // https://developer.nvidia.com/content/alpha-blending-pre-or-not-pre
  // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Fix upside down images.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
}

/*
 * TODO
 */
GLState.prototype.createDefaultObjects = function () {
  var gl = this.gl;

  this.createDefaultTexture(gl);
};

/*
 * WebGL spams console when sampling an unbound texture, so we bind this.
 */
GLState.prototype.createDefaultTexture = function (gl) {
  if (this.defaultTexture) {
    console.warn('Attempted to remake default texture');
    return;
  }

  var data = [
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff
  ];

  var tex = gl.createTexture();
  this.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data));
  this.bindTexture(gl.TEXTURE_2D, null);
  this.defaultTexture = tex;
};
},{"./uniform.js":39}],28:[function(require,module,exports){
'use strict';

// glslify.file breaks Chrome auto-mapping, so we keep it separate from the
// other animals.

var glslify = require('glslify');

exports.defaultVertexShader = glslify(["#define GLSLIFY 1\nuniform mat4 ProjectionMatrix;\nuniform mat4 ViewMatrix;\n\nattribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\nattribute mat4 aModelViewMatrix;\n\nvarying vec2 vTexCoord;\n\n#ifdef M_LIT\n\n//\n// Lighting\n//\nconst float Light_GlobalAmbient = 0.2;\n\nstruct Light {\n  vec4 position;\n  vec4 diffuse;\n  vec4 ambient;\n  vec4 specular;\n};\n\nconst Light Light0 = Light(\n  vec4(-8.0, +32.0, -8.0, 0.0),\n  vec4(1.0, 0.8, 0.8, 1.0),\n  vec4(0.7, 0.7, 0.7, 1.0),\n  vec4(1.0, 0.8, 0.8, 1.0)\n);\n\nconst Light Light1 = Light(\n  vec4(+8.0, +32.0, +8.0, 0.0),\n  vec4(0.8, 1.0, 0.8, 1.0),\n  vec4(0.7, 0.7, 0.7, 1.0),\n  vec4(0.8, 1.0, 0.8, 1.0)\n);\n\nuniform vec4 uDiffuse;\nuniform vec4 uAmbient;\nuniform vec4 uSpecular;\nuniform vec4 uEmissive;\nuniform float uShininess;\nuniform bool uEnvironment;\n\nvarying vec4 vLightColor;\n\nvec4 calcLight(Light light, vec4 eyeNormal) {\n  // Assume directional lights.\n  // TODO specular\n  vec4 lightPos = ViewMatrix * light.position;\n  return\n    uAmbient * light.ambient +\n    max(0.0, dot(eyeNormal, normalize(lightPos))) * uDiffuse * light.diffuse;\n}\n#endif // M_LIT\n\n#ifdef M_ENVIRONMENT\nvec2 genSphereMap(vec3 p, vec3 n) {\n  vec3 u = normalize(p);\n  vec3 r = reflect(u, n);\n  r.z += 1.0;\n  float m = 2.0 * length(r);\n  return vec2(r.x / m + 0.5, r.y / m + 0.5);\n}\n#endif\n\nvoid main() {\n  vec3 eyeNormal = normalize(mat3(aModelViewMatrix) * aNormal);\n  vec4 eyePos = aModelViewMatrix * vec4(aPosition, 1.0);\n\n#ifdef M_LIT\n  vec4 lightColor =\n    uEmissive +\n    uAmbient * Light_GlobalAmbient +\n    calcLight(Light0, vec4(eyeNormal, 1.0)) +\n    calcLight(Light1, vec4(eyeNormal, 1.0));\n\n  vLightColor = clamp(vec4(lightColor.rgb, uDiffuse.a), 0.0, 1.0);\n  //vLightColor.rgb = vLightColor.rgb * vLightColor.a; // Premultiply.\n#endif\n\n#if defined(M_ENVIRONMENT)\n  vTexCoord = genSphereMap(eyePos.xyz, eyeNormal);\n#else\n  vTexCoord = aTexCoord;\n#endif\n\n  gl_Position = ProjectionMatrix * eyePos;\n}\n"]);
exports.defaultFragmentShader = glslify(["precision highp float;\n#define GLSLIFY 1\n\nuniform sampler2D uTexture;\n\nvarying vec2 vTexCoord;\n#ifdef M_LIT\nvarying vec4 vLightColor;\n#endif\n\nvoid main() {\n#ifdef M_LIT\n  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor;\n#else\n  gl_FragColor = texture2D(uTexture, vTexCoord);\n#endif\n}\n"]);

},{"glslify":6}],29:[function(require,module,exports){
'use strict';

module.exports = Parabola;

var data = require('./data.js');

var GLState = require('./gl-state.js');
var GLPool = require('./gl-pool.js');
var Scene = require('./scene.js');
var SolidModel = require('./solid-model.js');
var Mtrl = require('./mtrl.js');
var Batch = require('./batch.js');
var Solid = require('./solid.js');

function Parabola(opts) {

}

var getDeltaTime = (function () {
  var lastTime = 0.0;

  return function (currTime) {
    var dt = (currTime - lastTime) / 1000.0;

    if (dt > 1.0) {
      dt = 0.0;
    }

    lastTime = currTime;
    return dt;
  };
})();

/**
 * Create a SolidModel to serve as background gradient.
 *
 * This takes a 'map-back/back.sol' SOL file, inserts the
 * given gradient material/image into it, and sets up
 * an appropriate transform matrix.
 */
Parabola.createGradientModel = function (pool, entities, sol) {
  // Create the material object.
  var gradMtrl = Mtrl.fromSolMtrl(sol, 0);
  // Disable depth testing and depth writes on the material.
  gradMtrl.flagsPerPass[0] &= ~Mtrl.DEPTH_TEST;
  gradMtrl.flagsPerPass[0] &= ~Mtrl.DEPTH_WRITE;
  // Cache it manually to keep our flag changes from being overwritten.
  pool._cacheMtrl(gradMtrl);

  // Cache the rest of the resources.
  pool.cacheSol(sol);

  // Create a model.
  var model = SolidModel.fromSol(sol, entities);

  // Scale it.
  const BACK_DIST = 256.0;
  model.sceneNode.setLocalMatrix([0, 0, 0], [0, 0, 0, 1], [-BACK_DIST, BACK_DIST, -BACK_DIST]);

  // Set the sort layer for the entire model.
  model.setBatchSortLayer(Batch.LAYER_GRADIENT);

  return model;
};

/**
 * Mark all billboards as background billboards.
 */
Parabola.createBackgroundModel = function (pool, entities, sol) {
  for (var i = 0, n = sol.bills.length; i < n; ++i) {
    var bill = sol.bills[i];
    bill.fl |= Solid.BILL_BACK;
  }

  pool.cacheSol(sol);
  var model = SolidModel.fromSol(sol, entities);
  model.setBatchSortLayer(Batch.LAYER_BACKGROUND);
  return model;
}

Parabola.backgrounds = {
  'alien': { sol: 'map-back/alien.sol', gradient: 'back/alien' },
  'city': { sol: 'map-back/city.sol', gradient: 'back/city' },
  'clouds': { sol: 'map-back/clouds.sol', gradient: 'back/land' },
  'jupiter': { sol: 'map-back/jupiter.sol', gradient: 'back/space' },
  'ocean': { sol: 'map-back/ocean.sol', gradient: 'back/ocean' },
  'volcano': { sol: 'map-back/volcano.sol', gradient: 'back/volcano' },
}

Parabola.backgroundNames = [
  'alien', 'city', 'clouds', 'jupiter', 'ocean', 'volcano',
];

function init() {
  var canvas = document.getElementById('canvas');
  var state = GLState(canvas);
  var pool = GLPool();
  var scene = Scene();
  var gl = state.gl;
  var solFile = null;

  var backgroundName = 'alien';//Parabola.backgroundNames[Math.floor(Math.random() * (Parabola.backgroundNames.length))];
  var background = Parabola.backgrounds[backgroundName];

  function createObjects(res) {
    res.createObjects(state);
  }

  pool.emitter.on('mtrl', createObjects);
  pool.emitter.on('model', createObjects);
  pool.emitter.on('shader', createObjects);

  data.fetchSol('geom/back/back.sol')
    .then(function (sol) {
      // Replace the first SOL material with a gradient image.
      sol.mv[0].f = background.gradient;
      return sol;
    })
    .then(function (sol) {
      var model = Parabola.createGradientModel(pool, scene.entities, sol);
      scene.setModel(state, 'gradient', model);
      return model;
    });

  data.fetchSol(background.sol)
    .then(function (sol) {
      var model = Parabola.createBackgroundModel(pool, scene.entities, sol);
      scene.setModel(state, 'background', model);
      return model;
    });

  var modelPaths = {
    level: 'map-fwp/adventure.sol',
    coin: 'item/coin/coin.sol',
    coin5: 'item/coin/coin5.sol',
    coin10: 'item/coin/coin10.sol',
    grow: 'item/grow/grow.sol',
    shrink: 'item/shrink/shrink.sol',
    jump: 'geom/beam/beam.sol',
    // ballInner: 'ball/reactor/reactor-inner.sol',
    ballSolid: 'ball/basic-ball/basic-ball-solid.sol',
    // ballOuter: 'ball/reactor/reactor-outer.sol'
  };

  // var testSol = Solid.genTestMap2();
  // var testModel = SolidModel.fromSol(testSol, scene.entities);
  // scene.setModel('level', testModel);

  for (let modelName in modelPaths) {
    data.fetchSol(modelPaths[modelName])
      .then(function (sol) {
        if (sol.dicts.drawback === '1') {
          for (var mi = 0, mc = sol.mtrls.length; mi < mc; ++mi) {
            sol.mtrls[mi].fl |= Solid.MTRL_TWO_SIDED_SEPARATE;
          }
        }
        return sol;
      })
      .then(function (sol) {
        // Hack.
        if (modelName === 'level') {
          solFile = sol;
        }

        pool.cacheSol(sol);
        var model = SolidModel.fromSol(sol, scene.entities);
        scene.setModel(state, modelName, model);
        return model;
      });
  }

  /*
   * Basic requestAnimationFrame loop.
   */
  function animationFrame(currTime) {
    window.requestAnimationFrame(animationFrame);

    var dt = getDeltaTime(currTime);

    if (dt < 1.0) {
      step(dt);
    }
  }
  window.requestAnimationFrame(animationFrame);

  var currWidth = 0;
  var currHeight = 0;
  function step(dt) {
    if (currWidth !== canvas.clientWidth || currHeight !== canvas.clientHeight) {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;

      // Update projection matrix with CSS dimensions.
      scene.view.setProjection(w, h, 50);

      // Resize drawing buffer to CSS dimensions.
      canvas.width = w;
      canvas.height = h;

      // Update viewport.
      gl.viewport(0, 0, w, h);

      // Save values.
      currWidth = w;
      currHeight = h;
    }

    scene.view.mouseLook(0, 0);
    scene.step(dt);
    scene.draw(state);
  }

  var modelListElem = document.getElementById('model-list');

  scene.emitter.on('model-added', function (model) {
    var li = document.createElement('li');

    li.textContent = model.id;
    li.dataset.modelId = model.id;

    modelListElem.appendChild(li);
  });

  scene.emitter.on('model-assigned', function (slotName, model) {
    for (var i = 0, n = modelListElem.children.length; i < n; ++i) {
      var li = modelListElem.children[i];

      if (model) {
        if (li.dataset.modelId === model.id) {
          li.dataset.slotName = slotName;
          li.textContent += ' (' + slotName + ')';
          break;
        }
      } else {
        if (li.dataset.slotName === slotName) {
          li.textContent = li.textContent.replace(' (' + slotName + ')', '');
          break;
        }
      }
    }
  });

  var slotLoadButton = document.getElementById('slot-load');
  var slotFileInput = document.getElementById('slot-file');
  var slotNameInput = document.getElementById('slot-name');

  slotLoadButton.addEventListener('click', function (event) {
        if (!slotFileInput.files.length) {
      return;
    }

    var slotName = slotNameInput.value;
    var fileReader = new FileReader();

    fileReader.addEventListener('load', function (event) {
      // Parse the selected SOL, create a SolidModel from it, and assign the SolidModel to the selected slot name.

      var sol = Solid(fileReader.result);

      sol.id = slotFileInput.files[0].name;

      if (sol.dicts.drawback === '1') {
        for (var mi = 0, mc = sol.mtrls.length; mi < mc; ++mi) {
          sol.mtrls[mi].fl |= Solid.MTRL_TWO_SIDED_SEPARATE;
        }
      }

      // Hack.
      if (slotName === 'level') {
        solFile = sol;
      }

      pool.cacheSol(sol);
      var model = SolidModel.fromSol(sol, scene.entities);
      scene.setModel(state, slotName, model);
    });

    fileReader.readAsArrayBuffer(slotFileInput.files[0]);
  });

  function mouseMove(e) {
    scene.view.mouseLook(e.movementX, e.movementY);
  }

  function pointerLockChange(e) {
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', mouseMove);

      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
    } else {
      document.removeEventListener('mousemove', mouseMove);

      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    }
  }

  function togglePointerLock(e) {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      canvas.requestPointerLock();
    }
  }

  canvas.addEventListener('click', togglePointerLock);
  document.addEventListener('pointerlockchange', pointerLockChange);

  var setViewPositionInput = document.getElementById('set-view-position');

  if (setViewPositionInput) {
    setViewPositionInput.addEventListener('input', function () {
      if (solFile) {
        scene.view.setFromSol(solFile, this.value);
      }
    });
  }

  var toggleFullscreenInput = document.getElementById('toggle-fullscreen');
  var mainElement = document.getElementById('main');

  if (toggleFullscreenInput) {
    toggleFullscreenInput.addEventListener('change', function () {
      if (document.fullscreenEnabled) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            mainElement.requestFullscreen();
          }
      }
    });
  }

  if (document.fullscreenEnabled) {
    mainElement.addEventListener('fullscreenchange', function (event) {
      if (toggleFullscreenInput) {
        toggleFullscreenInput.checked = !!document.fullscreenElement;
      }
      if (document.fullscreenElement) {
        // TODO add body class
      } else {
        // TODO remove body class
      }
    });
  }

  function keyDown(e) {
    var code = e.code; // Not very portable.

    if (code === 'KeyW') {
      scene.view.moveForward(true);
    } else if (code === 'KeyA') {
      scene.view.moveLeft(true);
    } else if (code === 'KeyS') {
      scene.view.moveBackward(true);
    } else if (code === 'KeyD') {
      scene.view.moveRight(true);
    }
  }
  function keyUp(e) {
    var code = e.code;

    if (code === 'KeyW') {
      scene.view.moveForward(false);
    } else if (code === 'KeyA') {
      scene.view.moveLeft(false);
    } else if (code === 'KeyS') {
      scene.view.moveBackward(false);
    } else if (code === 'KeyD') {
      scene.view.moveRight(false);
    }
  }

  canvas.addEventListener('wheel', function (e) {
    scene.view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  }, { passive: false });

  var toggleTexturesInput = document.getElementById('toggle-textures');

  if (toggleTexturesInput) {
    toggleTexturesInput.addEventListener('change', function (e) {
      state.enableTextures = this.checked;
    });
  }

  var maxBatchesInput = document.getElementById('max-batches');
  if (maxBatchesInput) {
    maxBatchesInput.addEventListener('change', function (event) {
      this.setAttribute('max', scene._batches.length);
      scene._maxRenderedBatches = this.value;
    });
  }

  var sceneTimeInput = document.getElementById('scene-time');
  if (sceneTimeInput) {
    sceneTimeInput.addEventListener('change', function (event) {
      scene.fixedTime = parseFloat(this.value);
    })
  }
}

init();

},{"./batch.js":22,"./data.js":24,"./gl-pool.js":26,"./gl-state.js":27,"./mtrl.js":33,"./scene.js":35,"./solid-model.js":37,"./solid.js":38}],30:[function(require,module,exports){
'use strict';

module.exports = MeshData;

/**
 * This is basically a vertex array object, but we keep the source
 * vertex data around for easy rebuilding in case of GL context loss.
 */
function MeshData() {
  if (!(this instanceof MeshData)) {
    return new MeshData();
  }

  // Vertex data and store.
  this.verts = null;
  this.vertsVBO = null;

  // Element data and store.
  this.elems = null;
  this.elemsVBO = null;

  // Model-view matrix store. 1 matrix per scene-node instance.
  this.instanceVBO = null;

  // All of the above, but activated with one GL call.
  this.vao = null;
}

MeshData.prototype.createObjects = function (state) {
  var meshData = this;
  var gl = state.gl;
  var attrs = state.vertexAttrs;

  // Create VBOs.

  meshData.vertsVBO = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, meshData.vertsVBO);
  gl.bufferData(gl.ARRAY_BUFFER, meshData.verts, gl.STATIC_DRAW);

  meshData.elemsVBO = gl.createBuffer();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshData.elemsVBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.elems, gl.STATIC_DRAW);

  meshData.instanceVBO = gl.createBuffer();
  /*
   * Matrix data depends on the number of model instances,
   * which is not yet known at this point.
   */

  // Create and set up the VAO.

  meshData.vao = state.createVertexArray();

  state.bindVertexArray(meshData.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, meshData.vertsVBO);

  gl.vertexAttribPointer(attrs.Position, 3, gl.FLOAT, false, 8 * 4, 0);
  gl.vertexAttribPointer(attrs.Normal, 3, gl.FLOAT, false, 8 * 4, 12);
  gl.vertexAttribPointer(attrs.TexCoord, 2, gl.FLOAT, false, 8 * 4, 24);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshData.elemsVBO);

  gl.enableVertexAttribArray(attrs.Position);
  gl.enableVertexAttribArray(attrs.Normal);
  gl.enableVertexAttribArray(attrs.TexCoord);

  // The complex art of passing a 4x4 matrix as a vertex attribute.

  gl.enableVertexAttribArray(attrs.ModelViewMatrix + 0);
  gl.enableVertexAttribArray(attrs.ModelViewMatrix + 1);
  gl.enableVertexAttribArray(attrs.ModelViewMatrix + 2);
  gl.enableVertexAttribArray(attrs.ModelViewMatrix + 3);

  gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);

  gl.vertexAttribPointer(attrs.ModelViewMatrix + 0, 4, gl.FLOAT, false, 16 * 4, 0);
  gl.vertexAttribPointer(attrs.ModelViewMatrix + 1, 4, gl.FLOAT, false, 16 * 4, 16);
  gl.vertexAttribPointer(attrs.ModelViewMatrix + 2, 4, gl.FLOAT, false, 16 * 4, 32);
  gl.vertexAttribPointer(attrs.ModelViewMatrix + 3, 4, gl.FLOAT, false, 16 * 4, 48);

  state.vertexAttribDivisor(attrs.ModelViewMatrix + 0, 1);
  state.vertexAttribDivisor(attrs.ModelViewMatrix + 1, 1);
  state.vertexAttribDivisor(attrs.ModelViewMatrix + 2, 1);
  state.vertexAttribDivisor(attrs.ModelViewMatrix + 3, 1);

  state.bindVertexArray(null);
};

MeshData.prototype.bindVertexArray = function (state) {
  var meshData = this;

  if (meshData.vao) {
    state.bindVertexArray(meshData.vao);
  }
};

},{}],31:[function(require,module,exports){
'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;

/*
 * Walk the path entities in life. Don't we all.
 */
function Mover (path) {
  if (!(this instanceof Mover)) {
    return new Mover(path);
  }
  this.path = path || null;
  this.time = 0.0;
}

/*
 * Create movers for a SOL body.
 */
Mover.fromSolBody = function (sol, body) {
  // sol_load_vary()

  var movers = {
    translate: null,
    rotate: null
  };

  movers.translate = Mover(sol.pv[body.pi]);

  if (body.pj === body.pi) {
    movers.rotate = movers.translate;
  } else {
    movers.rotate = Mover(sol.pv[body.pj]);
  }

  return movers;
};

/*
 * Motion easing.
 */
function erp (t) {
  // float erp(float t)
  return 3.0 * t * t - 2.0 * t * t * t;
}

/*
 * Calculate position (optionally after DT seconds).
 */
Mover.prototype.getPosition = function (p, dt = 0.0) {
  // sol_body_p()

  vec3.set(p, 0, 0, 0);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;
    var s;

    if (thisPath.f) {
      s = (this.time + dt) / thisPath.t;
    } else {
      s = this.time / thisPath.t;
    }

    vec3.lerp(p, thisPath.p, nextPath.p, thisPath.s ? erp(s) : s);
  }

  return p;
};

/*
 * Calculate orientation (optionally after DT seconds) as a quaternion.
 */
Mover.prototype.getOrientation = function (e, dt = 0.0) {
  // sol_body_e()

  const P_ORIENTED = 0x1;

  quat.identity(e);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.fl & P_ORIENTED || nextPath.fl & P_ORIENTED) {
      var s;

      if (thisPath.f) {
        s = (this.time + dt) / thisPath.t;
      } else {
        s = this.time / thisPath.t;
      }

      quat.slerp(e, thisPath.e, nextPath.e, thisPath.s ? erp(s) : s);
    }
  }

  return e;
};

/*
 * Walk forward DT seconds.
 */
Mover.prototype.step = function (dt) {
  // TODO Count milliseconds to keep time-aware entities in sync.

  if (this.path) {
    var thisPath = this.path;

    if (thisPath.f) {
      this.time += dt;

      if (this.time >= thisPath.t) {
        this.time = 0.0;
        this.path = thisPath.next;
      }
    }
  }
};

/*
 * Exports.
 */
module.exports = Mover;

},{"gl-matrix":5}],32:[function(require,module,exports){
module.exports={"back/alien":"back/alien.png","back/blk_blu":"back/blk_blu.png","back/blk_cyn":"back/blk_cyn.png","back/blk_grn":"back/blk_grn.png","back/blk_org":"back/blk_org.png","back/blues":"back/blues.png","back/blu_cyn":"back/blu_cyn.png","back/blu_grn":"back/blu_grn.png","back/blu_wht":"back/blu_wht.png","back/city":"back/city.png","back/cyn_grn":"back/cyn_grn.png","back/cyn_wht":"back/cyn_wht.png","back/greens":"back/greens.png","back/greys":"back/greys.png","back/grn_wht":"back/grn_wht.png","back/grn_yel":"back/grn_yel.png","back/gui":"back/gui.png","back/land":"back/land.png","back/ocean":"back/ocean.png","back/org_yel":"back/org_yel.png","back/pastel":"back/pastel.png","back/paxed01":"back/paxed01.png","back/paxed02":"back/paxed02.png","back/paxed03":"back/paxed03.png","back/paxed04":"back/paxed04.png","back/paxed05":"back/paxed05.png","back/paxed06":"back/paxed06.png","back/paxed07":"back/paxed07.png","back/paxed08":"back/paxed08.png","back/paxed09":"back/paxed09.png","back/paxed10":"back/paxed10.png","back/paxed11":"back/paxed11.png","back/paxed12":"back/paxed12.png","back/paxed13":"back/paxed13.png","back/paxed14":"back/paxed14.png","back/purples":"back/purples.png","back/red_blu":"back/red_blu.png","back/red_prp":"back/red_prp.png","back/red_wht":"back/red_wht.png","back/sea_land":"back/sea_land.png","back/space":"back/space.png","back/volcano":"back/volcano.png","ball/atom/atom-glow":"ball/atom/atom-glow.png","ball/atom/electron":"ball/atom/electron.png","ball/atom/neutron":"ball/atom/neutron.png","ball/atom/proton":"ball/atom/proton.png","ball/basic-ball/basic-ball":"ball/basic-ball/basic-ball.png","ball/blinky/blinky":"ball/blinky/blinky.png","ball/catseye/bubble":"ball/catseye/bubble.png","ball/catseye/catseye-surface":"ball/catseye/catseye-surface.png","ball/catseye/catseye":"ball/catseye/catseye.png","ball/cheese-ball/cheese-ball":"ball/cheese-ball/cheese-ball.png","ball/diagonal-ball/diagonal-ball":"ball/diagonal-ball/diagonal-ball.png","ball/earth/earth-atmos":"ball/earth/earth-atmos.png","ball/earth/earth-cloud":"ball/earth/earth-cloud.png","ball/earth/earth-color":"ball/earth/earth-color.png","ball/earth/earth-ocean":"ball/earth/earth-ocean.png","ball/eyeball/eyeball":"ball/eyeball/eyeball.png","ball/eyeball/lens":"ball/eyeball/lens.png","ball/lava/lava-glow":"ball/lava/lava-glow.png","ball/lava/lava-inner":"ball/lava/lava-inner.png","ball/lava/lava-solid":"ball/lava/lava-solid.png","ball/magic-eightball/magic-eightball":"ball/magic-eightball/magic-eightball.png","ball/melon/melon":"ball/melon/melon.png","ball/octocat/octocat":"ball/octocat/octocat.png","ball/orange/orange":"ball/orange/orange.png","ball/reactor/flare1":"ball/reactor/flare1.png","ball/reactor/flare2":"ball/reactor/flare2.png","ball/reactor/reactor-surface":"ball/reactor/reactor-surface.png","ball/reactor/sparkle1":"ball/reactor/sparkle1.png","ball/rift/rift":"ball/rift/rift.jpg","ball/saturn/saturn-ring":"ball/saturn/saturn-ring.png","ball/saturn/saturn-surface":"ball/saturn/saturn-surface.jpg","ball/snowglobe/snowglobe-atlas":"ball/snowglobe/snowglobe-atlas.jpg","ball/snowglobe/snowglobe-snow":"ball/snowglobe/snowglobe-snow.png","ball/snowglobe/snowglobe-star":"ball/snowglobe/snowglobe-star.png","ball/snowglobe/snowglobe-surface":"ball/snowglobe/snowglobe-surface.png","ball/sootsprite/sootsprite-body-outer":"ball/sootsprite/sootsprite-body-outer.png","ball/sootsprite/sootsprite-body-solid":"ball/sootsprite/sootsprite-body-solid.png","ball/sootsprite/sootsprite-eye":"ball/sootsprite/sootsprite-eye.png","ball/ufo/alien":"ball/ufo/alien.png","ball/ufo/poof-blue":"ball/ufo/poof-blue.png","ball/ufo/thruster":"ball/ufo/thruster.png","geom/beam/beam":"geom/beam/beam.png","geom/goal/goal":"geom/goal/goal.png","geom/jump/jump":"geom/jump/jump.png","geom/vect/vect":"geom/vect/vect.png","gui/classic/back-hilite-focus":"gui/classic/back-hilite-focus.png","gui/classic/back-hilite":"gui/classic/back-hilite.png","gui/classic/back-plain-focus":"gui/classic/back-plain-focus.png","gui/classic/back-plain":"gui/classic/back-plain.png","gui/cursor":"gui/cursor.png","gui/help1":"gui/help1.jpg","gui/help2":"gui/help2.jpg","gui/help3":"gui/help3.jpg","gui/help4":"gui/help4.jpg","icon/neverball":"icon/neverball.png","icon/neverputt":"icon/neverputt.png","item/coin/chinese_coin":"item/coin/chinese_coin.png","item/coin/chinese_trad_coin":"item/coin/chinese_trad_coin.png","item/coin/coin-glow":"item/coin/coin-glow.png","item/coin/coin-no":"item/coin/coin-no.png","item/coin/coin":"item/coin/coin.png","item/coin/coin1":"item/coin/coin1.png","item/coin/coin10":"item/coin/coin10.png","item/coin/coin5":"item/coin/coin5.png","item/coin/euro_coin":"item/coin/euro_coin.png","item/coin/forint_coin":"item/coin/forint_coin.png","item/coin/pound_coin":"item/coin/pound_coin.png","item/coin/ruble_coin":"item/coin/ruble_coin.png","item/coin/won_coin":"item/coin/won_coin.png","item/coin/zloty_coin":"item/coin/zloty_coin.png","item/grow/grow":"item/grow/grow.png","item/shrink/shrink":"item/shrink/shrink.png","png/buildings1":"png/buildings1.png","png/city1":"png/city1.png","png/city2":"png/city2.png","png/city4":"png/city4.png","png/clouds1":"png/clouds1.png","png/clouds2":"png/clouds2.png","png/clouds3":"png/clouds3.png","png/contrail":"png/contrail.png","png/grid":"png/grid.png","png/hills1":"png/hills1.png","png/hills2":"png/hills2.png","png/hills3":"png/hills3.png","png/io":"png/io.png","png/jupiter":"png/jupiter.png","png/loops1":"png/loops1.png","png/loops2":"png/loops2.png","png/loops3":"png/loops3.png","png/meteorite":"png/meteorite.png","png/moon":"png/moon.png","png/mount1":"png/mount1.png","png/mount2":"png/mount2.png","png/part":"png/part.png","png/shadow":"png/shadow.png","png/smoke1":"png/smoke1.png","png/smoke2":"png/smoke2.png","png/smoke3":"png/smoke3.png","png/space":"png/space.png","png/stars1":"png/stars1.png","png/stars2":"png/stars2.png","png/stars3":"png/stars3.png","png/stars4":"png/stars4.png","png/sun":"png/sun.png","png/v-cloud1":"png/v-cloud1.png","png/v-cloud2":"png/v-cloud2.png","png/v-cloud3":"png/v-cloud3.png","png/v-cloud4":"png/v-cloud4.png","png/v-cloud5":"png/v-cloud5.png","png/v-crack1":"png/v-crack1.png","png/v-crack2":"png/v-crack2.png","png/v-crack3":"png/v-crack3.png","png/v-crack4":"png/v-crack4.png","png/v-floor":"png/v-floor.png","png/v-hill1":"png/v-hill1.png","png/v-hill2":"png/v-hill2.png","png/v-hill3":"png/v-hill3.png","png/v-hill4":"png/v-hill4.png","png/v-mountains1":"png/v-mountains1.png","png/v-mountains2":"png/v-mountains2.png","png/v-mountains3":"png/v-mountains3.png","png/v-stars1":"png/v-stars1.png","png/v-stars2":"png/v-stars2.png","png/v-stars3":"png/v-stars3.png","png/v-stars4":"png/v-stars4.png","png/v-sun":"png/v-sun.png","png/volcano1":"png/volcano1.png","png/volcano2":"png/volcano2.png","png/volcano3":"png/volcano3.png","png/volcano4":"png/volcano4.png","png/wave":"png/wave.png","shot-easy/bumper":"shot-easy/bumper.jpg","shot-easy/bumps":"shot-easy/bumps.jpg","shot-easy/coins":"shot-easy/coins.jpg","shot-easy/corners":"shot-easy/corners.jpg","shot-easy/curved":"shot-easy/curved.jpg","shot-easy/easy":"shot-easy/easy.jpg","shot-easy/easyhalfpipe":"shot-easy/easyhalfpipe.jpg","shot-easy/fence":"shot-easy/fence.jpg","shot-easy/goals":"shot-easy/goals.jpg","shot-easy/goslow":"shot-easy/goslow.jpg","shot-easy/greed":"shot-easy/greed.jpg","shot-easy/groundbreak":"shot-easy/groundbreak.jpg","shot-easy/hole":"shot-easy/hole.jpg","shot-easy/lollipop":"shot-easy/lollipop.jpg","shot-easy/maze":"shot-easy/maze.jpg","shot-easy/mazebump":"shot-easy/mazebump.jpg","shot-easy/mover":"shot-easy/mover.jpg","shot-easy/peasy":"shot-easy/peasy.jpg","shot-easy/roundcoins":"shot-easy/roundcoins.jpg","shot-easy/roundlaby":"shot-easy/roundlaby.jpg","shot-easy/slalom":"shot-easy/slalom.jpg","shot-easy/slightcurve":"shot-easy/slightcurve.jpg","shot-easy/speedbumps":"shot-easy/speedbumps.jpg","shot-easy/thwomp2":"shot-easy/thwomp2.jpg","shot-easy/wakka":"shot-easy/wakka.jpg","shot-fwp/adventure":"shot-fwp/adventure.png","shot-fwp/atrium":"shot-fwp/atrium.png","shot-fwp/buoys":"shot-fwp/buoys.png","shot-fwp/cargo":"shot-fwp/cargo.png","shot-fwp/confetti":"shot-fwp/confetti.png","shot-fwp/discs":"shot-fwp/discs.png","shot-fwp/inferno":"shot-fwp/inferno.png","shot-fwp/ladybirds":"shot-fwp/ladybirds.png","shot-fwp/mountains":"shot-fwp/mountains.png","shot-fwp/museum":"shot-fwp/museum.png","shot-fwp/oddities":"shot-fwp/oddities.png","shot-fwp/rails":"shot-fwp/rails.png","shot-fwp/ramps":"shot-fwp/ramps.png","shot-fwp/rings":"shot-fwp/rings.png","shot-fwp/slope":"shot-fwp/slope.png","shot-fwp/spacetime":"shot-fwp/spacetime.png","shot-fwp/swarm":"shot-fwp/swarm.png","shot-fwp/tennis":"shot-fwp/tennis.png","shot-fwp/tree":"shot-fwp/tree.png","shot-fwp/ufo":"shot-fwp/ufo.png","shot-hard/airways":"shot-hard/airways.jpg","shot-hard/check":"shot-hard/check.jpg","shot-hard/curbs":"shot-hard/curbs.jpg","shot-hard/flip":"shot-hard/flip.jpg","shot-hard/frogger":"shot-hard/frogger.jpg","shot-hard/gaps":"shot-hard/gaps.jpg","shot-hard/grid":"shot-hard/grid.jpg","shot-hard/hallways":"shot-hard/hallways.jpg","shot-hard/hump":"shot-hard/hump.jpg","shot-hard/invis":"shot-hard/invis.jpg","shot-hard/movers":"shot-hard/movers.jpg","shot-hard/nostairs":"shot-hard/nostairs.jpg","shot-hard/paths":"shot-hard/paths.jpg","shot-hard/pipe":"shot-hard/pipe.jpg","shot-hard/poker":"shot-hard/poker.jpg","shot-hard/pyramid":"shot-hard/pyramid.jpg","shot-hard/quads":"shot-hard/quads.jpg","shot-hard/rampup":"shot-hard/rampup.jpg","shot-hard/ring":"shot-hard/ring.jpg","shot-hard/risers":"shot-hard/risers.jpg","shot-hard/spiralin":"shot-hard/spiralin.jpg","shot-hard/spread":"shot-hard/spread.jpg","shot-hard/sync":"shot-hard/sync.jpg","shot-hard/teleport":"shot-hard/teleport.jpg","shot-hard/tilt":"shot-hard/tilt.jpg","shot-medium/accordian":"shot-medium/accordian.jpg","shot-medium/angle":"shot-medium/angle.jpg","shot-medium/coneskeleton":"shot-medium/coneskeleton.jpg","shot-medium/cross":"shot-medium/cross.jpg","shot-medium/drops":"shot-medium/drops.jpg","shot-medium/easytele":"shot-medium/easytele.jpg","shot-medium/four":"shot-medium/four.jpg","shot-medium/hardrise":"shot-medium/hardrise.jpg","shot-medium/islands":"shot-medium/islands.jpg","shot-medium/learngrow":"shot-medium/learngrow.jpg","shot-medium/locks":"shot-medium/locks.jpg","shot-medium/multicurves":"shot-medium/multicurves.jpg","shot-medium/plinko":"shot-medium/plinko.jpg","shot-medium/qbert":"shot-medium/qbert.jpg","shot-medium/rampdn":"shot-medium/rampdn.jpg","shot-medium/roundfloors":"shot-medium/roundfloors.jpg","shot-medium/sparselines":"shot-medium/sparselines.jpg","shot-medium/spiraldn":"shot-medium/spiraldn.jpg","shot-medium/spiralup":"shot-medium/spiralup.jpg","shot-medium/stairs":"shot-medium/stairs.jpg","shot-medium/telemaze":"shot-medium/telemaze.jpg","shot-medium/timer":"shot-medium/timer.jpg","shot-medium/title":"shot-medium/title.jpg","shot-medium/woodmaze":"shot-medium/woodmaze.jpg","shot-medium/zigzag":"shot-medium/zigzag.jpg","shot-misc/bigball-old":"shot-misc/bigball-old.jpg","shot-misc/billiard":"shot-misc/billiard.png","shot-misc/blockers":"shot-misc/blockers.jpg","shot-misc/bounce":"shot-misc/bounce.jpg","shot-misc/bounce2":"shot-misc/bounce2.jpg","shot-misc/checkers":"shot-misc/checkers.jpg","shot-misc/elevator":"shot-misc/elevator.jpg","shot-misc/freefall-old":"shot-misc/freefall-old.jpg","shot-misc/groweasy":"shot-misc/groweasy.png","shot-misc/grow_demo":"shot-misc/grow_demo.jpg","shot-misc/ocean":"shot-misc/ocean.jpg","shot-misc/stairs":"shot-misc/stairs.jpg","shot-misc/thwomp1":"shot-misc/thwomp1.jpg","shot-mym/assault":"shot-mym/assault.jpg","shot-mym/circuit1":"shot-mym/circuit1.jpg","shot-mym/circuit2":"shot-mym/circuit2.jpg","shot-mym/climb":"shot-mym/climb.jpg","shot-mym/comeback":"shot-mym/comeback.jpg","shot-mym/dance1":"shot-mym/dance1.jpg","shot-mym/dance2":"shot-mym/dance2.jpg","shot-mym/descent":"shot-mym/descent.jpg","shot-mym/drive1":"shot-mym/drive1.jpg","shot-mym/drive2":"shot-mym/drive2.jpg","shot-mym/earthquake":"shot-mym/earthquake.jpg","shot-mym/ghosts":"shot-mym/ghosts.jpg","shot-mym/glasstower":"shot-mym/glasstower.jpg","shot-mym/hard":"shot-mym/hard.jpg","shot-mym/loop1":"shot-mym/loop1.jpg","shot-mym/loop2":"shot-mym/loop2.jpg","shot-mym/maze1":"shot-mym/maze1.jpg","shot-mym/maze2":"shot-mym/maze2.jpg","shot-mym/narrow":"shot-mym/narrow.jpg","shot-mym/running":"shot-mym/running.jpg","shot-mym/scrambling":"shot-mym/scrambling.jpg","shot-mym/snow":"shot-mym/snow.jpg","shot-mym/trust":"shot-mym/trust.jpg","shot-mym/turn":"shot-mym/turn.jpg","shot-mym/up":"shot-mym/up.jpg","shot-mym2/backforth":"shot-mym2/backforth.jpg","shot-mym2/basket":"shot-mym2/basket.jpg","shot-mym2/bigball":"shot-mym2/bigball.jpg","shot-mym2/bigcone":"shot-mym2/bigcone.jpg","shot-mym2/bombman":"shot-mym2/bombman.jpg","shot-mym2/bounces":"shot-mym2/bounces.jpg","shot-mym2/fall":"shot-mym2/fall.jpg","shot-mym2/freefall":"shot-mym2/freefall.jpg","shot-mym2/grinder":"shot-mym2/grinder.jpg","shot-mym2/littlecones":"shot-mym2/littlecones.jpg","shot-mym2/longpipe":"shot-mym2/longpipe.jpg","shot-mym2/morenarrow":"shot-mym2/morenarrow.jpg","shot-mym2/movinglumps":"shot-mym2/movinglumps.jpg","shot-mym2/movingpath":"shot-mym2/movingpath.jpg","shot-mym2/push":"shot-mym2/push.jpg","shot-mym2/rainbow":"shot-mym2/rainbow.jpg","shot-mym2/rodeo":"shot-mym2/rodeo.jpg","shot-mym2/runstop":"shot-mym2/runstop.jpg","shot-mym2/shaker":"shot-mym2/shaker.jpg","shot-mym2/sonic":"shot-mym2/sonic.jpg","shot-mym2/speed":"shot-mym2/speed.jpg","shot-mym2/speeddance":"shot-mym2/speeddance.jpg","shot-mym2/translation":"shot-mym2/translation.jpg","shot-mym2/updown":"shot-mym2/updown.jpg","shot-mym2/webs":"shot-mym2/webs.jpg","shot-putt/abc":"shot-putt/abc.jpg","shot-putt/iCourse":"shot-putt/iCourse.png","shot-putt/paxed":"shot-putt/paxed.jpg","shot-putt/paxed2":"shot-putt/paxed2.jpg","shot-putt/paxed3":"shot-putt/paxed3.jpg","shot-putt/putt":"shot-putt/putt.jpg","shot-putt/slippi":"shot-putt/slippi.jpg","shot-putt/tricky-golf":"shot-putt/tricky-golf.jpg","shot-putt/vidski":"shot-putt/vidski.jpg","shot-tones/bigtube":"shot-tones/bigtube.jpg","shot-tones/blue":"shot-tones/blue.jpg","shot-tones/bumperoo":"shot-tones/bumperoo.jpg","shot-tones/canals":"shot-tones/canals.jpg","shot-tones/check":"shot-tones/check.jpg","shot-tones/city":"shot-tones/city.jpg","shot-tones/discs":"shot-tones/discs.jpg","shot-tones/easyian":"shot-tones/easyian.jpg","shot-tones/easyone":"shot-tones/easyone.jpg","shot-tones/hotwheels":"shot-tones/hotwheels.jpg","shot-tones/hurdles":"shot-tones/hurdles.jpg","shot-tones/leaps":"shot-tones/leaps.jpg","shot-tones/marble":"shot-tones/marble.jpg","shot-tones/runner":"shot-tones/runner.jpg","shot-tones/skiball":"shot-tones/skiball.jpg","shot-tones/swish":"shot-tones/swish.jpg","shot-tones/swoop":"shot-tones/swoop.jpg","shot-tones/tonesmaze":"shot-tones/tonesmaze.jpg","shot-tones/twisted":"shot-tones/twisted.jpg","shot-tones/waves":"shot-tones/waves.jpg","mtrl/arrow-dark":"textures/mtrl/arrow-dark.png","mtrl/arrow-green-light":"textures/mtrl/arrow-green-light.png","mtrl/arrow-light":"textures/mtrl/arrow-light.png","mtrl/asteroid":"textures/mtrl/asteroid.png","mtrl/black-decal":"textures/mtrl/black-decal.png","mtrl/black":"textures/mtrl/black.png","mtrl/blue-fade":"textures/mtrl/blue-fade.png","mtrl/blue-gas":"textures/mtrl/blue-gas.png","mtrl/blue-glossy":"textures/mtrl/blue-glossy.png","mtrl/blue-gradient-bright":"textures/mtrl/blue-gradient-bright.png","mtrl/blue-gradient":"textures/mtrl/blue-gradient.png","mtrl/blue-natural":"textures/mtrl/blue-natural.png","mtrl/blue-sea":"textures/mtrl/blue-sea.png","mtrl/blue-wave":"textures/mtrl/blue-wave.png","mtrl/blue":"textures/mtrl/blue.png","mtrl/border-carpet":"textures/mtrl/border-carpet.jpg","mtrl/brass-faceted":"textures/mtrl/brass-faceted.jpg","mtrl/brass":"textures/mtrl/brass.jpg","mtrl/brick-small":"textures/mtrl/brick-small.png","mtrl/brick":"textures/mtrl/brick.jpg","mtrl/brown":"textures/mtrl/brown.png","mtrl/carpet":"textures/mtrl/carpet.jpg","mtrl/caution":"textures/mtrl/caution.png","mtrl/chalk":"textures/mtrl/chalk.jpg","mtrl/check-black-white":"textures/mtrl/check-black-white.png","mtrl/chrome-faceted":"textures/mtrl/chrome-faceted.jpg","mtrl/chrome":"textures/mtrl/chrome.jpg","mtrl/coin-blue":"textures/mtrl/coin-blue.jpg","mtrl/coin-brown-small":"textures/mtrl/coin-brown-small.jpg","mtrl/coin-green-check":"textures/mtrl/coin-green-check.jpg","mtrl/coin-green-check2":"textures/mtrl/coin-green-check2.jpg","mtrl/coin-green-dark":"textures/mtrl/coin-green-dark.jpg","mtrl/coin-green-light":"textures/mtrl/coin-green-light.jpg","mtrl/coin-green-small":"textures/mtrl/coin-green-small.jpg","mtrl/coin-mirror-check":"textures/mtrl/coin-mirror-check.png","mtrl/coin-orange-big":"textures/mtrl/coin-orange-big.jpg","mtrl/coin-orange":"textures/mtrl/coin-orange.jpg","mtrl/coin-pad-dot-blue":"textures/mtrl/coin-pad-dot-blue.png","mtrl/coin-pad-dot-red":"textures/mtrl/coin-pad-dot-red.png","mtrl/coin-pad-dot-yellow":"textures/mtrl/coin-pad-dot-yellow.png","mtrl/coin-pad-green-dark":"textures/mtrl/coin-pad-green-dark.png","mtrl/coin-pad-red-dark":"textures/mtrl/coin-pad-red-dark.png","mtrl/coin-purple-check":"textures/mtrl/coin-purple-check.jpg","mtrl/coin-purple":"textures/mtrl/coin-purple.jpg","mtrl/coin-red":"textures/mtrl/coin-red.jpg","mtrl/coin-shiny":"textures/mtrl/coin-shiny.jpg","mtrl/crate-small":"textures/mtrl/crate-small.jpg","mtrl/crate":"textures/mtrl/crate.jpg","mtrl/curtain-check-diagonal":"textures/mtrl/curtain-check-diagonal.png","mtrl/cyan":"textures/mtrl/cyan.png","mtrl/dot-grey":"textures/mtrl/dot-grey.png","mtrl/edge-blue":"textures/mtrl/edge-blue.jpg","mtrl/edge-brown":"textures/mtrl/edge-brown.jpg","mtrl/edge-green-check":"textures/mtrl/edge-green-check.jpg","mtrl/edge-green-check2":"textures/mtrl/edge-green-check2.jpg","mtrl/edge-green-dark":"textures/mtrl/edge-green-dark.jpg","mtrl/edge-green-light":"textures/mtrl/edge-green-light.jpg","mtrl/edge-green-offset":"textures/mtrl/edge-green-offset.jpg","mtrl/edge-green":"textures/mtrl/edge-green.jpg","mtrl/edge-orange-big":"textures/mtrl/edge-orange-big.jpg","mtrl/edge-orange":"textures/mtrl/edge-orange.jpg","mtrl/edge-purple-check":"textures/mtrl/edge-purple-check.jpg","mtrl/edge-purple":"textures/mtrl/edge-purple.jpg","mtrl/edge-red":"textures/mtrl/edge-red.jpg","mtrl/edge-x":"textures/mtrl/edge-x.png","mtrl/edge-y":"textures/mtrl/edge-y.png","mtrl/edge":"textures/mtrl/edge.png","mtrl/edge2-blue":"textures/mtrl/edge2-blue.jpg","mtrl/edge2-brown":"textures/mtrl/edge2-brown.jpg","mtrl/edge2-green-check":"textures/mtrl/edge2-green-check.jpg","mtrl/edge2-green-dark":"textures/mtrl/edge2-green-dark.jpg","mtrl/edge2-green-light":"textures/mtrl/edge2-green-light.jpg","mtrl/edge2-green-offset":"textures/mtrl/edge2-green-offset.jpg","mtrl/edge2-green-small":"textures/mtrl/edge2-green-small.jpg","mtrl/edge2-green":"textures/mtrl/edge2-green.jpg","mtrl/edge2-orange-big":"textures/mtrl/edge2-orange-big.jpg","mtrl/edge2-orange":"textures/mtrl/edge2-orange.jpg","mtrl/edge2-purple-check":"textures/mtrl/edge2-purple-check.jpg","mtrl/edge2-purple":"textures/mtrl/edge2-purple.jpg","mtrl/edge2-red":"textures/mtrl/edge2-red.jpg","mtrl/edge2-x":"textures/mtrl/edge2-x.png","mtrl/edge2-y":"textures/mtrl/edge2-y.png","mtrl/edge2":"textures/mtrl/edge2.png","mtrl/fire":"textures/mtrl/fire.png","mtrl/glass-dark":"textures/mtrl/glass-dark.png","mtrl/glass":"textures/mtrl/glass.png","mtrl/goal-1024":"textures/mtrl/goal-1024.png","mtrl/goal-special":"textures/mtrl/goal-special.png","mtrl/goal":"textures/mtrl/goal.png","mtrl/green-gas":"textures/mtrl/green-gas.png","mtrl/green":"textures/mtrl/green.png","mtrl/hole":"textures/mtrl/hole.png","mtrl/invisible":"textures/mtrl/invisible.png","mtrl/leaf":"textures/mtrl/leaf.jpg","mtrl/marble-brown-polished":"textures/mtrl/marble-brown-polished.jpg","mtrl/marble-grey-polished":"textures/mtrl/marble-grey-polished.jpg","mtrl/marble-grey":"textures/mtrl/marble-grey.jpg","mtrl/marble-purple-polished":"textures/mtrl/marble-purple-polished.jpg","mtrl/marble-purple":"textures/mtrl/marble-purple.jpg","mtrl/mirror-blue":"textures/mtrl/mirror-blue.png","mtrl/mirror-check-weak":"textures/mtrl/mirror-check-weak.png","mtrl/mirror-check":"textures/mtrl/mirror-check.png","mtrl/mirror-cyan":"textures/mtrl/mirror-cyan.png","mtrl/mirror-dark":"textures/mtrl/mirror-dark.png","mtrl/mirror-green":"textures/mtrl/mirror-green.png","mtrl/mirror-orange":"textures/mtrl/mirror-orange.png","mtrl/mirror-purple":"textures/mtrl/mirror-purple.png","mtrl/mirror-red":"textures/mtrl/mirror-red.png","mtrl/mirror-yellow":"textures/mtrl/mirror-yellow.png","mtrl/mirror":"textures/mtrl/mirror.png","mtrl/orb-blue":"textures/mtrl/orb-blue.png","mtrl/pink-cream":"textures/mtrl/pink-cream.png","mtrl/plank-diagonal":"textures/mtrl/plank-diagonal.jpg","mtrl/plank-small-light":"textures/mtrl/plank-small-light.jpg","mtrl/plank-small":"textures/mtrl/plank-small.jpg","mtrl/plank":"textures/mtrl/plank.jpg","mtrl/polka-grey":"textures/mtrl/polka-grey.png","mtrl/poof-blue":"textures/mtrl/poof-blue.png","mtrl/poof-green":"textures/mtrl/poof-green.png","mtrl/poof-red":"textures/mtrl/poof-red.png","mtrl/poof-yellow":"textures/mtrl/poof-yellow.png","mtrl/purple-pattern":"textures/mtrl/purple-pattern.jpg","mtrl/rail":"textures/mtrl/rail.png","mtrl/rainbow":"textures/mtrl/rainbow.png","mtrl/red-gas":"textures/mtrl/red-gas.png","mtrl/red-glass":"textures/mtrl/red-glass.png","mtrl/red-glossy":"textures/mtrl/red-glossy.png","mtrl/red-gradient-bright":"textures/mtrl/red-gradient-bright.png","mtrl/red-gradient":"textures/mtrl/red-gradient.png","mtrl/red-pattern":"textures/mtrl/red-pattern.jpg","mtrl/red":"textures/mtrl/red.png","mtrl/rotate180":"textures/mtrl/rotate180.png","mtrl/rotate90":"textures/mtrl/rotate90.png","mtrl/shadow-rock":"textures/mtrl/shadow-rock.png","mtrl/sign-end":"textures/mtrl/sign-end.png","mtrl/sign-no-smoking":"textures/mtrl/sign-no-smoking.png","mtrl/sign-warning":"textures/mtrl/sign-warning.png","mtrl/space-mapped":"textures/mtrl/space-mapped.jpg","mtrl/stripes":"textures/mtrl/stripes.png","mtrl/switch":"textures/mtrl/switch.png","mtrl/teleporter":"textures/mtrl/teleporter.png","mtrl/thwomp-fear":"textures/mtrl/thwomp-fear.png","mtrl/thwomp-grim":"textures/mtrl/thwomp-grim.png","mtrl/thwomp-gufaw":"textures/mtrl/thwomp-gufaw.png","mtrl/thwomp-incred":"textures/mtrl/thwomp-incred.png","mtrl/thwomp-mocking":"textures/mtrl/thwomp-mocking.png","mtrl/thwomp-sullen":"textures/mtrl/thwomp-sullen.png","mtrl/thwomp-whistler":"textures/mtrl/thwomp-whistler.png","mtrl/thwomp":"textures/mtrl/thwomp.png","mtrl/timer":"textures/mtrl/timer.png","mtrl/transparent-dark":"textures/mtrl/transparent-dark.png","mtrl/transparent":"textures/mtrl/transparent.png","mtrl/turf-blue":"textures/mtrl/turf-blue.jpg","mtrl/turf-brown-small":"textures/mtrl/turf-brown-small.jpg","mtrl/turf-brown":"textures/mtrl/turf-brown.jpg","mtrl/turf-disco":"textures/mtrl/turf-disco.jpg","mtrl/turf-green-check":"textures/mtrl/turf-green-check.jpg","mtrl/turf-green-check2":"textures/mtrl/turf-green-check2.jpg","mtrl/turf-green-dark":"textures/mtrl/turf-green-dark.jpg","mtrl/turf-green-light":"textures/mtrl/turf-green-light.jpg","mtrl/turf-green-offset":"textures/mtrl/turf-green-offset.jpg","mtrl/turf-green-small":"textures/mtrl/turf-green-small.jpg","mtrl/turf-green":"textures/mtrl/turf-green.jpg","mtrl/turf-grey-dark":"textures/mtrl/turf-grey-dark.jpg","mtrl/turf-grey":"textures/mtrl/turf-grey.jpg","mtrl/turf-orange-big":"textures/mtrl/turf-orange-big.jpg","mtrl/turf-orange":"textures/mtrl/turf-orange.jpg","mtrl/turf-purple-check":"textures/mtrl/turf-purple-check.jpg","mtrl/turf-purple":"textures/mtrl/turf-purple.jpg","mtrl/turf-red":"textures/mtrl/turf-red.jpg","mtrl/turf-shiny-light":"textures/mtrl/turf-shiny-light.jpg","mtrl/turf-shiny":"textures/mtrl/turf-shiny.jpg","mtrl/white":"textures/mtrl/white.png","mtrl/wood-check-glossy":"textures/mtrl/wood-check-glossy.jpg","mtrl/wood-check":"textures/mtrl/wood-check.jpg","mtrl/wood-glossy":"textures/mtrl/wood-glossy.jpg","mtrl/wood-light-glossy":"textures/mtrl/wood-light-glossy.jpg","mtrl/wood-light":"textures/mtrl/wood-light.jpg","mtrl/wood":"textures/mtrl/wood.jpg","mtrl/words-ca":"textures/mtrl/words-ca.png","mtrl/words-de":"textures/mtrl/words-de.png","mtrl/words-fr":"textures/mtrl/words-fr.png","mtrl/words-gd":"textures/mtrl/words-gd.png","mtrl/words-lv":"textures/mtrl/words-lv.png","mtrl/words-nn":"textures/mtrl/words-nn.png","mtrl/words-sk":"textures/mtrl/words-sk.png","mtrl/words":"textures/mtrl/words.png","mtrl/yellow-decal":"textures/mtrl/yellow-decal.png","mtrl/yellow-glossy":"textures/mtrl/yellow-glossy.png","mtrl/yellow-gradient-bright":"textures/mtrl/yellow-gradient-bright.png","mtrl/yellow-gradient":"textures/mtrl/yellow-gradient.png","mtrl/yellow-natural":"textures/mtrl/yellow-natural.png","mtrl/yellow":"textures/mtrl/yellow.png","mtrl/zip":"textures/mtrl/zip.png"}
},{}],33:[function(require,module,exports){
'use strict';

var Solid = require('./solid.js');
var data = require('./data.js');

module.exports = Mtrl;

var _materialIndex = 0;

function Mtrl(name) {
  if (!(this instanceof Mtrl)) {
    return new Mtrl(name);
  }

  this.name = name;
  this.flagsPerPass = [ 0 ];

  // DOM image
  this._image = null;
  // DOM image promise;
  this._imageProm = null;
  // GL texture
  this.texture = null;

  // TODO
  this.diffuse = null;
  this.ambient = null;
  this.specular = null;
  this.emission = null;
  this.shininess = -0.0;

  this.id = 'Mtrl:' + _materialIndex++;
}

Mtrl.fromSolMtrl = function (sol, mi) {
  var solMtrl = sol.mtrls[mi];
  var mtrl = Mtrl(solMtrl.f);

  var passCount = getPassCountFromSolMtrl(solMtrl);

  mtrl.flagsPerPass = new Array(passCount);

  for (var passIndex = 0; passIndex < passCount; ++passIndex) {
    mtrl.flagsPerPass[passIndex] = getFlagsFromSolMtrl(solMtrl, passIndex);
  }

  mtrl.diffuse = solMtrl.d;
  mtrl.ambient = solMtrl.a;
  mtrl.specular = solMtrl.s;
  mtrl.emission = solMtrl.e;
  mtrl.shininess = solMtrl.h;

  return mtrl;
};

Mtrl.DEPTH_WRITE = (1 << 0);
Mtrl.DEPTH_TEST = (1 << 1);
Mtrl.BLEND = (1 << 2);
Mtrl.ADDITIVE = (1 << 3);
Mtrl.POLYGON_OFFSET = (1 << 4);
Mtrl.CULL_FACE_BACK = (1 << 5);
Mtrl.CULL_FACE_FRONT = (1 << 6);
Mtrl.CLAMP_T = (1 << 7); // TODO: move this elsewhere.
Mtrl.CLAMP_S = (1 << 8); // TODO: move this elsewhere.

/**
 * Count passes for this material.
 */
function getPassCountFromSolMtrl(solMtrl) {
  var passCount = 1;
  var solFlags = solMtrl.fl;

  if (solFlags & Solid.MTRL_TWO_SIDED_SEPARATE) {
    passCount = 2;
  }

  return passCount;
}

/**
 * Break down SOL material flags into GL state changes.
 */
function getFlagsFromSolMtrl (solMtrl, passIndex = 0) {
  var solFlags = solMtrl.fl;
  var flags = Mtrl.DEPTH_TEST;

  if (!(solFlags & Solid.MTRL_TRANSPARENT)) {
    flags |= Mtrl.DEPTH_WRITE;
  }

  if ((solFlags & Solid.MTRL_TRANSPARENT) || (solFlags & Solid.MTRL_ADDITIVE)) {
    flags |= Mtrl.BLEND;
  }

  if (solFlags & Solid.MTRL_ADDITIVE) {
    flags |= Mtrl.ADDITIVE;
  }

  if (solFlags & Solid.MTRL_DECAL) {
    flags |= Mtrl.POLYGON_OFFSET;
  }

  if (solFlags & Solid.MTRL_TWO_SIDED_SEPARATE) {
    if (passIndex === 0) {
      // First pass: cull front-facing polygons.
      flags |= Mtrl.CULL_FACE_FRONT;
    } else {
      // Second pass: cull back-facing polygons.
      flags |= Mtrl.CULL_FACE_BACK;
    }
  } else {
    if (solFlags & Solid.MTRL_TWO_SIDED) {
      // No culling.
    } else {
      // Default culling.
      flags |= Mtrl.CULL_FACE_BACK;
    }
  }

  if (solFlags & Solid.MTRL_CLAMP_T) {
    flags |= Mtrl.CLAMP_T;
  }

  if (solFlags & Solid.MTRL_CLAMP_S) {
    flags |= Mtrl.CLAMP_S;
  }

  return flags;
}

/*
 * Create a GL texture from the given image.
 */
Mtrl.prototype.createTexture = function (state) {
  if (!this._image) {
    throw Error('Attempted to create material texture without image data')
  }

  var flags = this.flagsPerPass[0]; // TODO

  var gl = state.gl;
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
    flags & Mtrl.CLAMP_S ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
    flags & Mtrl.CLAMP_T ? gl.CLAMP_TO_EDGE : gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.texture = tex;
};

/*
 * Apply material state.
 */
Mtrl.prototype.apply = function (state, passIndex = 0) {
  var mtrl = this;
  var gl = state.gl;

  if (mtrl.texture && state.enableTextures) {
    state.bindTexture(gl.TEXTURE_2D, mtrl.texture);
  } else {
    state.bindTexture(gl.TEXTURE_2D, state.defaultTexture);
  }

  // TODO color cache
  var uniforms = state.uniforms;

  uniforms.uTexture.value = 0;

  uniforms.uDiffuse.value = mtrl.diffuse;
  uniforms.uAmbient.value = mtrl.ambient;
  uniforms.uSpecular.value = mtrl.specular;
  uniforms.uEmissive.value = mtrl.emission;
  uniforms.uShininess.value = mtrl.shininess;

  var flags = mtrl.flagsPerPass[passIndex];

  if (flags & Mtrl.DEPTH_WRITE) {
    state.depthMask(true);
  } else {
    state.depthMask(false);
  }

  if (flags & Mtrl.DEPTH_TEST) {
    state.enable(gl.DEPTH_TEST);
  } else {
    state.disable(gl.DEPTH_TEST);
  }

  if (flags & Mtrl.BLEND) {
    state.enable(gl.BLEND);
  } else {
    state.disable(gl.BLEND);
  }

  if (flags & Mtrl.ADDITIVE) {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  if (flags & Mtrl.POLYGON_OFFSET) {
    state.enable(gl.POLYGON_OFFSET_FILL);
    state.polygonOffset(-1.0, -2.0);
  } else {
    state.polygonOffset(0.0, 0.0);
    state.disable(gl.POLYGON_OFFSET_FILL);
  }

  if ((flags & Mtrl.CULL_FACE_BACK) || (flags & Mtrl.CULL_FACE_FRONT)) {
    state.enable(gl.CULL_FACE);
    state.cullFace((flags & Mtrl.CULL_FACE_FRONT) ? gl.FRONT : gl.BACK);
  } else {
    state.disable(gl.CULL_FACE);
  }
};

/*
 * Create material texture.
 */
Mtrl.prototype.createObjects = function (state) {
  var mtrl = this;

  mtrl.createTexture(state);
};

Mtrl.prototype.fetchImage = function () {
  var mtrl = this;

  if (!mtrl._imageProm) {
    mtrl._imageProm = data.fetchImageForMtrl(mtrl).then(function (image) {
      mtrl._image = image;
      return image;
    }).catch(function (reason) {
      console.warn(reason);
    });
  }

  return mtrl._imageProm;
};
},{"./data.js":24,"./solid.js":38}],34:[function(require,module,exports){
'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;

var utils = require('./utils.js');

module.exports = SceneNode;

var _nodeIndex = 0;

/**
 * This is a scene graph. A scene graph can serve many
 * purposes, but this one does one thing and one thing only:
 * it calculates the modelview matrices of its nodes. You
 * can create a hierarchy of a bunch of nodes, set their
 * local matrices whichever way you like, and then ask any
 * of them about their complete world matrix.
 *
 * As an extension of this, any node can be "instanced".
 * Such a node or "instance" has no local matrix, instead
 * it becomes a sort-of a puppet and uses the local matrix
 * of its "master" node. Such an instance can then be inserted
 * elsewhere in the scene node graph.
 */
function SceneNode(parent) {
  if (!(this instanceof SceneNode)) {
    return new SceneNode(parent);
  }

  this._id = 'node_' + (_nodeIndex++);

  this.parent = null;
  this.children = [];

  // Does the world matrix need to be updated?
  this.dirty = true;

  this.localMatrix = mat4.create();
  // Root nodes start out with a shared local/world matrix.
  this.worldMatrix = this.localMatrix;
  // Pre-allocate a separate matrix in case we get parented.
  this._worldMatrix = mat4.create();

  // Instances use the localMatrix of a master node.
  this.master = null;
  this.instances = [];

  // Getting world matrices of instances is a common use case.
  this._instanceMatrices = new Float32Array(16);
  this.instanceMatrices = this._instanceMatrices;

  if (parent !== undefined) {
    this.setParent(parent);
  }
}

/**
 * Mark this tree of nodes for update.
 */
SceneNode.prototype._markDirty = function () {
  var i;

  for (i = 0; i < this.children.length; ++i) {
    this.children[i]._markDirty();
  }

  for (i = 0; i < this.instances.length; ++i) {
    this.instances[i]._markDirty();
  }

  this.dirty = true;
};

/**
 * Set local matrix given a position vector, rotation quaternion and scale.
 *
 * Scale can be either a scalar or an array.
 */
SceneNode.prototype.setLocalMatrix = (function () {
  // Preallocate.
  var s_ = vec3.create();

  return function (p, e, s) {
    if (this.master) {
      throw Error('Can not set the local matrix of a node instance');
    }

    if (s.length) {
      mat4.fromRotationTranslationScale(this.localMatrix, e, p, s);
    } else {
      vec3.set(s_, s, s, s);
      mat4.fromRotationTranslationScale(this.localMatrix, e, p, s_);
    }
    this._markDirty();
  };
})();

/**
 * Update and return the world matrix of this node.
 */
SceneNode.prototype.getWorldMatrix = function () {
  this._update();
  return this.worldMatrix;
};

/**
 * Get the world matrices of all instances of this node.
 */
SceneNode.prototype.getInstanceMatrices = (function () {
  var M = mat4.create();

  return function (viewMatrix = null) {
    if (this.instances.length) {
      if (this.instanceMatrices.length !== this.instances.length * 16) {
        this.instanceMatrices = new Float32Array(16 * this.instances.length);
      }

      var instanceMatrices = this.instanceMatrices;

      for (var i = 0, n = this.instances.length; i < n; ++i) {
        var instance = this.instances[i];
        var worldMatrix = instance.getWorldMatrix();

        if (viewMatrix) {
          mat4.multiply(M, viewMatrix, worldMatrix);
          utils.mat4_copyToOffset(instanceMatrices, i * 16, M);
        } else {
          utils.mat4_copyToOffset(instanceMatrices, i * 16, worldMatrix);
        }

      }
    } else {
      if (this.instanceMatrices !== this._instanceMatrices) {
        this.instanceMatrices = this._instanceMatrices;
      }
    }
    return this.instanceMatrices;
  }
})();

/**
 * Test the given node for ancestry.
 */
SceneNode.prototype.hasAncestor = function (node) {
  if (node === null) {
    return false;
  } else {
    return this.parent && (this.parent === node || this.parent.hasAncestor(node));
  }
};

/**
 * Set node parent.
 */
SceneNode.prototype.setParent = function (node) {
  if (this === node || node.hasAncestor(this)) {
    throw Error('Can not parent node to itself');
  }

  if (this.parent) {
    removeFromList(this.parent.children, this);
  }

  this.parent = node;
  this.dirty = true;

  if (node) {
    addToList(node.children, this);

    if (this.worldMatrix === this.localMatrix) {
      // We are now a child node, no longer sharing matrices.
      this.worldMatrix = this._worldMatrix;
    }
  } else {
    // We are now a root node, sharing matrices.
    this.worldMatrix = this.localMatrix;
  }
};

/**
 * Use the localMatrix of the given node.
 */
SceneNode.prototype._setMaster = function (node) {
  if (this.master) {
    removeFromList(this.master.instances, this);
  }

  this.master = node;
  this.dirty = true;

  if (node) {
    addToList(node.instances, this);
  }
};

/**
 * Find the one true master.
 */
SceneNode.prototype.getMaster = function () {
  if (this.master) {
    return this.master.getMaster();
  }
  return this;
};

/**
 * Create an instance of this node tree.
 */
SceneNode.prototype.createInstance = function () {
  var node = SceneNode();
  var master = this.getMaster();
  node._id = master._id + ' instance';

  node._setMaster(master);

  // Create instances of all children and parent them to this node.

  for (var i = 0; i < this.children.length; ++i) {
    var child = this.children[i].createInstance();
    child.setParent(node);
  }

  return node;
};

/**
 * Remove a node and its children from the scene graph.
 */
SceneNode.prototype.remove = function () {
  this._setMaster(null);
  this.setParent(null);

  for (var i = 0, n = this.children.length; i < n; ++i) {
    this.children[i].remove();
  }
};

/**
 * Recursively find the given node and remove it.
 */
SceneNode.prototype.removeNode = function (node) {
  if (!node) {
    return;
  }
  if (!node.hasAncestor(this)) {
    return;
  }

  for (var i = 0, n = this.children.length; i < n; ++i) {
    this.children[i].removeNode(node);
  }
}

/**
 * Add unique object to list.
 */
function addToList(list, obj) {
  var index = list.indexOf(obj);
  if (index < 0) {
    list.push(obj);
  }
}

/**
 * Remove matching object from list.
 */
function removeFromList(list, obj) {
  var index = list.indexOf(obj);
  if (index >= 0) {
    list.splice(index, 1);
  }
}

/**
 * Return the effective local matrix of this node.
 */
SceneNode.prototype._getLocalMatrix = function () {
  if (this.master) {
    return this.master._getLocalMatrix();
  } else {
    return this.localMatrix;
  }
};

/**
 * Update world matrices of this and any parent/master nodes.
 */
SceneNode.prototype._update = function () {
  if (this.dirty) {
    var parent = this.parent;

    if (parent) {
      mat4.multiply(this.worldMatrix, parent.getWorldMatrix(), this._getLocalMatrix());
    } else if (this.master || this.worldMatrix !== this.localMatrix) {
      mat4.copy(this.worldMatrix, this._getLocalMatrix());
    }

    this.dirty = false;
  }
};

SceneNode.prototype.dump = function (depth = 0) {
  var str = this._id;

  if (this.master) {
    str += ' instance';
  }

  if (this.children.length) {
    str += ', ' + this.children.length + ' children';
  }

  if (this.instances.length) {
    str += ', ' + this.instances.length + ' instances';
  }

  str = ' '.repeat(depth * 2) + str;

  console.log(str);

  for (var i = 0; i < this.children.length; ++i) {
    this.children[i].dump(depth + 1);
  }
}
},{"./utils.js":40,"gl-matrix":5}],35:[function(require,module,exports){
'use strict';

var nanoECS = require('nano-ecs');
var EventEmitter = require('events');
var mat4 = require('gl-matrix').mat4;

var SceneNode = require('./scene-node.js');
var View = require('./view.js');
var Batch = require('./batch.js');
var EC = require('./entity-components.js');
var utils = require('./utils.js');

module.exports = Scene;

function Scene() {
  if (!(this instanceof Scene)) {
    return new Scene();
  }

  this.sceneRoot = SceneNode();

  this.view = View();
  this.time = 0.0;

  this.fixedTime = -1.0;

  // Named SolidModel slots (a SolidModel can be in multiple slots).
  this.models = {
    gradient: null,
    background: null,
    level: null,
    ballInner: null,
    ballSolid: null,
    ballOuter: null,
    coin: null,
    coin5: null,
    coin10: null,
    grow: null,
    shrink: null,
    beam: null,
    jump: null
  };

  // List of all SolidModels.
  this.allModels = [];

  // Entity manager.
  this.entities = nanoECS();

  this._createWorldEntities();

  // Events.
  this.emitter = new EventEmitter();

  // TODO
  this._bodyModels = [];
  this._batches = [];

  // TODO this is a tough one.
  // Key: BodyModel
  // Value: model.sceneNode instances reachable from this.sceneRoot.
  // Reason: so that we do not draw rogue instances that aren't actually attached to the scene graph.
  this._reachableInstances = new Map();
  this._instanceMatrices = new Map();
  this._modelSceneNodes = Object.create(null);

  this._maxRenderedBatches = -1;
}

Scene.prototype._createWorldEntity = function (modelSlot) {
  var ent = this.entities.createEntity();

  ent.addComponent(EC.SceneGraph);
  ent.addComponent(EC.SceneModel);

  // ent.sceneGraph.setParent(this.sceneRoot);
  ent.sceneModel.setSlot(modelSlot);

  return ent;
}

Scene.prototype._createWorldEntities = function () {
  this._createWorldEntity('gradient');
  this._createWorldEntity('background');
  this._createWorldEntity('level');
}

/**
 * Make a list of BodyModel scene node instances reachable from scene root.
 *
 * We're not walking the scene graph, because the nodes actually
 * have no idea about the model (or whatever) that owns them.
 */
Scene.prototype._updateReachableInstances = function () {
  var bodyModels = this._bodyModels;

  for (var bodyModelIndex = 0, bodyModelCount = bodyModels.length; bodyModelIndex < bodyModelCount; ++bodyModelIndex) {
    var bodyModel = bodyModels[bodyModelIndex];
    var reachableInstances = [];

    for (var instanceIndex = 0, instanceCount = bodyModel.sceneNode.instances.length; instanceIndex < instanceCount; ++instanceIndex) {
      var instance = bodyModel.sceneNode.instances[instanceIndex];

      if (instance.hasAncestor(this.sceneRoot)) {
        reachableInstances.push(instance);
      }
    }

    for (var batchIndex = 0, batchCount = bodyModel.batches.length; batchIndex < batchCount; ++batchIndex) {
      var batch = bodyModel.batches[batchIndex];
      batch.instanceCount = reachableInstances.length;
    }

    this._reachableInstances.set(bodyModel, reachableInstances);
    this._instanceMatrices.set(bodyModel, new Float32Array(reachableInstances.length * 16));
  }
};

Scene.prototype._addBodyModels = function (solidModel) {
  if (solidModel) {
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      var bodyModel = solidModel.models[i];

      if (this._bodyModels.indexOf(bodyModel) < 0) {
        this._bodyModels.push(bodyModel);

        this._addBatches(bodyModel.batches);
      }
    }
  }
}

Scene.prototype._removeBodyModels = function (solidModel) {
  if (solidModel) {
    // FIXME: when a SolidModel is in multiple slots, this removes all of them. Bummer.
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      var bodyModel = solidModel.models[i];
      var index = this._bodyModels.indexOf(bodyModel);

      if (index >= 0) {
        this._bodyModels.splice(index, 1);

        this._removeBatches(bodyModel.batches);
      }
    }
  }
}

Scene.prototype._addBatches = function (batches) {
  Array.prototype.push.apply(this._batches, batches);
}

Scene.prototype._removeBatches = function (batches) {
  for (var i = 0, n = batches.length; i < n; ++i) {
    var batch = batches[i];
    var index = this._batches.indexOf(batch);

    if (index >= 0) {
      this._batches.splice(index, 1);
    }
  }
}

/**
 * Assign a SolidModel to a named slot for use by entities.
 */
Scene.prototype.assignModelSlot = function (modelSlot, solidModel) {
  this._clearModelSlot(modelSlot);

  // Note: the SolidModel is inserted in the scene graph by the ECS.

  this._addBodyModels(solidModel);

  this.models[modelSlot] = solidModel;

  this.emitter.emit('model-assigned', modelSlot, solidModel);
}

/**
 * Clear a named slot and remove all model instances from the scene graph.
 */
Scene.prototype._clearModelSlot = function (modelSlot) {
  var sceneRoot = this.sceneRoot;
  var solidModel = this.models[modelSlot];

  if (solidModel) {
    this.models[modelSlot] = null;

    this._removeBodyModels(solidModel);

    // Step 1: remove model instances from the scene graph.

    var instances = solidModel.sceneNode.instances;

    for (var i = 0, n = instances.length; i < n; ++i) {
      var instance = instances[i];
      // Remove if reachable from scene root.
      sceneRoot.removeNode(instance);
    }

    // Step 2: tag all the entities that use this slot.

    var ents = this.entities.queryTag(modelSlot);

    for (var i = 0, n = ents.length; i < n; ++i) {
      var ent = ents[i];
      ent.addTag('needsModel');
    }
  }
};

/**
 * Add SolidModel to our list if not yet added.
 */
Scene.prototype._addModel = function (model) {
  var index = this.allModels.indexOf(model);

  if (index < 0) {
    this.allModels.push(model);
    this.emitter.emit('model-added', model);
  }
};

/*
 * Add a named SolidModel to the scene.
 */
Scene.prototype.setModel = function (state, modelSlot, solidModel) {
  this._addModel(solidModel);

  this.assignModelSlot(modelSlot, solidModel);
};

Scene.prototype.step = function (dt) {
  var scene = this;
  var view = this.view;

  if (scene.fixedTime >= 0.0) {
    var fakeDt = scene.fixedTime - scene.time;

    scene.time = scene.fixedTime;

    this.updateSystems(fakeDt);
  } else {
    scene.time += dt;

    this.updateSystems(dt);
  }


  view.step(dt);
};

/**
 * Make arrays of modelview matrices.
 *
 * For each model
 *   instance matrix 0
 *   instance matrix 1
 *   ...
 *   instance matrix N
 *
 * Arrays of instance matrix data are uploaded to VBOs for instanced rendering.
 */
Scene.prototype._uploadModelViewMatrices = (function () {
  var M = mat4.create();

  return function (state) {
    var gl = state.gl;

    var viewMatrix = this.view.getMatrix();

    for (var [bodyModel, instances] of this._reachableInstances) {
      var meshData = bodyModel.meshData;

      if (!meshData) {
        continue;
      }

      if (!meshData.instanceVBO) {
        continue;
      }

      if (!instances.length) {
        continue;
      }

      var instanceMatrices = this._instanceMatrices.get(bodyModel);

      for (var instanceIndex = 0, instanceCount = instances.length; instanceIndex < instanceCount; ++instanceIndex) {
        var instance = instances[instanceIndex];
        var worldMatrix = instance.getWorldMatrix();

        mat4.multiply(M, viewMatrix, worldMatrix);
        utils.mat4_copyToOffset(instanceMatrices, instanceIndex * 16, M);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);
      gl.bufferData(gl.ARRAY_BUFFER, instanceMatrices, gl.DYNAMIC_DRAW);
    }
  };
})();

Scene.prototype.draw = function (state) {
  this._uploadModelViewMatrices(state);

  Batch.sortBatches(this._batches);

  // Set some uniforms.

  state.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;
  state.uniforms.ViewMatrix.value = this.view.getMatrix();

  // Draw stuff.

  this._drawFrame(state, this._batches);
};

Scene.prototype._drawFrame = function (state, batches) {
  var gl = state.gl;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (var i = 0, n = batches.length; i < n; ++i) {
    if (this._maxRenderedBatches >= 0 && i >= this._maxRenderedBatches) {
      break;
    }

    var batch = batches[i];

    if (batch.instanceCount === 0) {
      break;
    }

    batch.draw(state);
  }
};

var MOVER_SYSTEM = [EC.Movers, EC.Spatial];
var BILLBOARD_SYSTEM = [EC.Billboard, EC.Spatial];
var SCENEGRAPH_SYSTEM = [EC.Spatial, EC.SceneGraph];

/**
 * Model slot system: attach SolidModels to entities that need them.
 */
Scene.prototype._updateModelSlots = function () {
  var ents = this.entities.queryTag('needsModel');

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    var modelSlot = ent.sceneModel.slot;
    var solidModel = this.models[modelSlot];

    if (solidModel) {
      // This is all very complicated.

      var instance = ent.sceneGraph.node.createInstance();
      instance.setParent(this.sceneRoot);
      solidModel.attachInstance(instance);

      // Here's the weird part: removeTag changes the array we loop over. So, we adjust.

      ent.removeTag('needsModel');

      n = ents.length;
      i = i - 1;
    }
  }

  this._updateReachableInstances();
}

/**
 * Mover system: get spatial position/orientation from the mover component.
 */
Scene.prototype._updateMovers = function (dt) {
  var ents = this.entities.queryComponents(MOVER_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    // Update movers.

    var moverTranslate = ent.movers.translate;
    var moverRotate = ent.movers.rotate;

    if (moverTranslate === moverRotate) {
      moverTranslate.step(dt);
    } else {
      moverTranslate.step(dt);
      moverRotate.step(dt);
    }

    // Update positions.

    // TODO do this only on actual update
    moverTranslate.getPosition(ent.spatial.position);
    moverRotate.getOrientation(ent.spatial.orientation);

    ent.spatial.dirty = true;
  }
}

/**
 * Billboard system: get spatial orientation/scale from the billboard component.
 */
Scene.prototype._updateBillboards = function () {
  var ents = this.entities.queryComponents(BILLBOARD_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    ent.billboard.getTransform(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale, this);

    ent.spatial.dirty = true;
  }
}

/**
 * Scene graph system: get scene node matrix from the spatial compontent.
 */
Scene.prototype._updateSceneGraph = function () {
  var ents = this.entities.queryComponents(SCENEGRAPH_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    if (ent.spatial.dirty) {
      ent.sceneGraph.setLocalMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);

      ent.spatial.dirty = false;
    }
  }
}

/**
 * Update entity systems.
 */
Scene.prototype.updateSystems = function (dt) {
  this._updateModelSlots();
  this._updateMovers(dt);
  this._updateBillboards();
  this._updateSceneGraph();
};

},{"./batch.js":22,"./entity-components.js":25,"./scene-node.js":34,"./utils.js":40,"./view.js":41,"events":4,"gl-matrix":5,"nano-ecs":8}],36:[function(require,module,exports){
'use strict';

var Solid = require('./solid.js');

module.exports = Shader;

function Shader (flags) {
  if (!(this instanceof Shader)) {
    return new Shader(flags);
  }

  this.program = null;
  this.vertexShader = '';
  this.fragmentShader = '';
  this.uniformLocationNames = [];
  this.uniformLocations = {};
  this.flags = (flags || 0);

  this.buildShaders();
}

Shader.LIT = 0x1;
Shader.ENVIRONMENT = 0x2;

Shader.prototype.buildShaders = function () {
  var defs = getDefsFromFlags(this.flags);

  this.vertexShader = defs + require('./glsl.js').defaultVertexShader;
  this.fragmentShader = defs + require('./glsl.js').defaultFragmentShader;
};

function getDefsFromFlags (flags) {
  var defs = '';

  if (flags & Shader.LIT) {
    defs += '#define M_LIT 1\n';
  }
  if (flags & Shader.ENVIRONMENT) {
    defs += '#define M_ENVIRONMENT 1\n';
  }

  return defs;
}

Shader.getFlagsFromSolMtrl = function (solMtrl) {
  var flags = 0;

  if (solMtrl.fl & Solid.MTRL_LIT) {
    flags |= Shader.LIT;
  }
  if (solMtrl.fl & Solid.MTRL_ENVIRONMENT) {
    flags |= Shader.ENVIRONMENT;
  }

  return flags;
};

Shader.fromSolMtrl = function (mtrl) {
  var flags = Shader.getFlagsFromSolMtrl(mtrl);
  var shader = Shader(flags);
  return shader;
};

Shader.prototype.use = function (state) {
  var program = this.program;

  if (program) {
    state.useProgram(program);
  }
};

Shader.prototype.createObjects = function (state) {
  var shader = this;
  var gl = state.gl;
  var attrs = state.vertexAttrs;

  if (shader.program) {
    console.warn('Shader program already exists');
    return;
  }

  var vs = compileShaderSource(gl, gl.VERTEX_SHADER, shader.vertexShader);
  var fs = compileShaderSource(gl, gl.FRAGMENT_SHADER, shader.fragmentShader);

  var prog = gl.createProgram();

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);

  // TODO unhardcode or something.

  gl.bindAttribLocation(prog, attrs.Position, 'aPosition');
  gl.bindAttribLocation(prog, attrs.Normal, 'aNormal');
  gl.bindAttribLocation(prog, attrs.TexCoord, 'aTexCoord');
  gl.bindAttribLocation(prog, attrs.ModelViewMatrix, 'aModelViewMatrix');

  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw gl.getProgramInfoLog(prog);
  }

  // Cache uniform locations that we want from the shader.

  for (var name in state.uniforms) {
    var location = gl.getUniformLocation(prog, name);

    if (location) {
      shader.uniformLocationNames.push(name);
      shader.uniformLocations[name] = location;
    }
  }

  shader.program = prog;
};

Shader.prototype.uploadUniforms = function (state) {
  var gl = state.gl;
  var shader = this;
  var program = shader.program;

  if (program) {
    var uniformLocationNames = shader.uniformLocationNames;
    var uniformLocations = shader.uniformLocations;

    for (var i = 0, n = uniformLocationNames.length; i < n; ++i) {
      var name = uniformLocationNames[i];
      var uniform = state.uniforms[name];
      var location = uniformLocations[name];

      uniform.upload(gl, location);
    }
  }
};

function compileShaderSource (gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw gl.getShaderInfoLog(shader);
  }
  return shader;
}

},{"./glsl.js":28,"./solid.js":38}],37:[function(require,module,exports){
'use strict';

var vec3 = require('gl-matrix').vec3;

var Mover = require('./mover.js');
var Solid = require('./solid.js');
var EC = require('./entity-components.js');
var SceneNode = require('./scene-node.js');

module.exports = SolidModel;

var solidModelIndex = 0;

function SolidModel(id) {
  if (!(this instanceof SolidModel)) {
    return new SolidModel(id);
  }

  this.id = id || 'SolidModel:' + (solidModelIndex++);
  this.sceneNode = SceneNode();
  this.models = null;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol, entities) {
  var solidModel = SolidModel('SolidModel:' + sol.id);
  solidModel.sceneNode._id = sol.id;

  var modelNode = solidModel.sceneNode;
  var ents = entities;
  var models = solidModel.models = [];
  var model = null;

  var i, n, ent;

  // Bodies

  for (i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Movers);
    ent.addComponent(EC.SceneGraph);

    // Body entities do not get a SceneModel component.

    model = sol._models[i];

    // Add body-model to solid-model body-model (yup) list.
    models.push(model);

    model.sceneNode.setParent(ent.sceneGraph.node);

    // Attach entity node to the solid-model node.
    ent.sceneGraph.setParent(modelNode);

    ent.sceneGraph.node._id = sol.id + ' body_' + i + ' entity';

    ent.movers.fromSolBody(sol, solBody);
    ent.movers.translate.getPosition(ent.spatial.position);
    ent.movers.rotate.getOrientation(ent.spatial.orientation);
  }

  // Items

  for (i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];
    var itemType = '';

    if (solItem.t === Solid.ITEM_GROW) {
      itemType = 'grow';
    } else if (solItem.t === Solid.ITEM_SHRINK) {
      itemType = 'shrink';
    } else if (solItem.t === Solid.ITEM_COIN) {
      if (solItem.n >= 10) {
        itemType = 'coin10';
      } else if (solItem.n >= 5) {
        itemType = 'coin5';
      } else {
        itemType = 'coin';
      }
    } else {
      continue;
    }

    ent = ents.createEntity();

    ent.addComponent(EC.Item);
    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    ent.sceneModel.setSlot(itemType);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.
  }

  // Teleporters.

  for (i = 0, n = sol.jv.length; i < n; ++i) {
    var solJump = sol.jv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    // TODO
    ent.sceneModel.setSlot('jump');

    vec3.copy(ent.spatial.position, solJump.p);
    ent.spatial.scale = [solJump.r, 2.0, solJump.r];
  }

  // Balls

  for (i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    ent.sceneModel.setSlot('ballSolid');

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);

    {
      var inner = ents.createEntity();

      inner.addComponent(EC.Spatial);
      inner.addComponent(EC.SceneGraph);
      inner.addComponent(EC.SceneModel);

      inner.sceneModel.setSlot('ballInner');

      inner.sceneGraph.setParent(ent.sceneGraph.node);

      inner.spatial.scale = solBall.r;
      vec3.copy(inner.spatial.position, solBall.p);

      var outer = ents.createEntity();

      outer.addComponent(EC.Spatial);
      outer.addComponent(EC.SceneGraph);
      outer.addComponent(EC.SceneModel);

      outer.sceneModel.setSlot('ballOuter');

      outer.sceneGraph.setParent(ent.sceneGraph.node);

      outer.spatial.scale = solBall.r;
      vec3.copy(outer.spatial.position, solBall.p);
    }
  }

  // Billboards

  for (i = 0, n = sol.rv.length; i < n; ++i) {
    var solBill = sol.rv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.Billboard);

    ent.billboard.fromSolBill(sol, solBill);

    // Get cached billboard model
    model = sol._billboardModels[i];

    // Add body-model to solid-model body-model (yup) list.
    if (models.indexOf(model) < 0) {
      models.push(model);
    }

    // Parent model scene-node to the entity scene-node.
    model.attachInstance(ent.sceneGraph.node);

    ent.sceneGraph.setParent(modelNode);

    vec3.copy(ent.spatial.position, solBill.p);
    ent.spatial.scale = [1.0, 1.0, 1.0];
  }

  return solidModel;
};

SolidModel.prototype.setBatchSortLayer = function (layer) {
  var bodyModels = this.models;

  for (var i = 0, n = bodyModels.length; i < n; ++i) {
    var bodyModel = bodyModels[i];
    var batches = bodyModel.batches;

    for (var j = 0, m = batches.length; j < m; ++j) {
      var batch = batches[j];

      batch.setSortLayer(layer);
    }
  }
}

SolidModel.prototype.attachInstance = function (parent) {
  var instance = this.sceneNode.createInstance();
  instance.setParent(parent);
  return instance;
}
},{"./entity-components.js":25,"./mover.js":31,"./scene-node.js":34,"./solid.js":38,"gl-matrix":5}],38:[function(require,module,exports){
'use strict';

/**
 * neverball-solid with extensions.
 */
var Solid = module.exports = require('neverball-solid');

/**
 * Billboard flag to indicate a background billboard.
 *
 * Not in Neverball.
 */
Solid.BILL_BACK = 0x10;

/**
 * Material flag for a two-pass back-face-first/front-face-second render.
 *
 * Not in Neverball.
 */
Solid.MTRL_TWO_SIDED_SEPARATE = (1 << 12);

/**
 * Create an empty SOL.
 */
Solid.empty = function () {
    var sol = {};

    sol.version = 8;

    sol.av = sol.bytes = [];
    sol.dv = sol.dicts = [];
    sol.mv = sol.mtrls = [];
    sol.vv = sol.verts = [];
    sol.ev = sol.edges = [];
    sol.sv = sol.sides = [];
    sol.tv = sol.texcs = [];
    sol.ov = sol.offs = [];
    sol.gv = sol.geoms = [];
    sol.lv = sol.lumps = [];
    sol.nv = sol.nodes = [];
    sol.pv = sol.paths = [];
    sol.bv = sol.bodies = [];
    sol.hv = sol.items = [];
    sol.zv = sol.goals = [];
    sol.jv = sol.jumps = [];
    sol.xv = sol.switches = [];
    sol.rv = sol.bills = [];
    sol.uv = sol.balls = [];
    sol.wv = sol.views = [];
    sol.iv = sol.indices = [];

    return sol;
}

Solid.genTestMap = function () {
    var sol = Solid.empty();

    for (var i = 0; i < 20; ++i) {
        for (var j = 0; j < 20; ++j) {
            for (var k = 0; k < 20; ++k) {
                sol.items.push({
                    p: [Math.random() * 25, Math.random() * 25, Math.random() * 25],
                    t: Math.random() > 0.5 ? Solid.ITEM_COIN : (Math.random() > 0.5 ? Solid.ITEM_GROW : Solid.ITEM_SHRINK),
                    n: Math.random() * 15
                });
            }
        }
    }

    return sol;
};

Solid.genTestMap2 = function () {
    var sol = Solid.empty();

    sol.balls.push({
        p: [0, 0, 0],
        r: 0.25
    });

    return sol;
};
},{"neverball-solid":11}],39:[function(require,module,exports){
'use strict';

const uniformAllocators = {
  i: () => 0,
  f: () => 0.0,
  vec2: () => new Float32Array(2),
  vec3: () => new Float32Array(3),
  vec4: () => new Float32Array(4),
  mat3: () => new Float32Array(9),
  mat4: () => new Float32Array(16)
};

const uniformUploaders = {
  i: function (gl, loc) { gl.uniform1i(loc, this.value); },
  f: function (gl, loc) { gl.uniform1f(loc, this.value); },
  vec2: function (gl, loc) { gl.uniform2fv(loc, this.value); },
  vec3: function (gl, loc) { gl.uniform3fv(loc, this.value); },
  vec4: function (gl, loc) { gl.uniform4fv(loc, this.value); },
  mat3: function (gl, loc) { gl.uniformMatrix3fv(loc, false, this.value); },
  mat4: function (gl, loc) { gl.uniformMatrix4fv(loc, false, this.value); }
};

for (let type in uniformAllocators) {
  module.exports[type] = function () {
    return {
      value: uniformAllocators[type](),
      upload: uniformUploaders[type]
    };
  };
}

},{}],40:[function(require,module,exports){
'use strict';

/**
 * Copy the values starting at index from an array to a mat4
 * @param {mat4} out the receiving matrix
 * @param {array} a the source array
 * @param {number} i index of first value in the source array
 * @returns {mat4} out
 */
exports.mat4_copyFromOffset = function (out, a, i) {
    out[0] = a[i + 0];
    out[1] = a[i + 1];
    out[2] = a[i + 2];
    out[3] = a[i + 3];
    out[4] = a[i + 4];
    out[5] = a[i + 5];
    out[6] = a[i + 6];
    out[7] = a[i + 7];
    out[8] = a[i + 8];
    out[9] = a[i + 9];
    out[10] = a[i + 10];
    out[11] = a[i + 11];
    out[12] = a[i + 12];
    out[13] = a[i + 13];
    out[14] = a[i + 14];
    out[15] = a[i + 15];
    return out;
};

/**
 * Copy the values from a mat4 to an array starting at index.
 * @param {array} out the receiving array
 * @param {number} i index of first value in the receiving array
 * @param {mat4} a the source matrix
 * @returns {array} out
 */
exports.mat4_copyToOffset = function (out, i, a) {
    out[i + 0] = a[0];
    out[i + 1] = a[1];
    out[i + 2] = a[2];
    out[i + 3] = a[3];
    out[i + 4] = a[4];
    out[i + 5] = a[5];
    out[i + 6] = a[6];
    out[i + 7] = a[7];
    out[i + 8] = a[8];
    out[i + 9] = a[9];
    out[i + 10] = a[10];
    out[i + 11] = a[11];
    out[i + 12] = a[12];
    out[i + 13] = a[13];
    out[i + 14] = a[14];
    out[i + 15] = a[15];
    return out;
};
},{}],41:[function(require,module,exports){
'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;
var toRadian = require('gl-matrix').glMatrix.toRadian;

module.exports = View;

function View (p, c) {
  if (!(this instanceof View)) {
    return new View(p, c);
  }

  this.p = vec3.create();
  this.c = vec3.create();
  this.u = vec3.fromValues(0, 1, 0);

  if (p && c) {
    vec3.copy(this.p, p);
    vec3.copy(this.c, c);
  } else if (p) {
    this.overhead(p);
  } else {
    this.overhead([0, 0, 0]);
  }

  this._basis = mat4.create();
  this._viewMatrix = mat4.create();
  this._projectionMatrix = mat4.create();

  // TODO
  this.speed = View.SPEED;
  this.backward = false;
  this.forward = false;
  this.left = false;
  this.right = false;
  this._dx = 0.0;
  this._dy = 0.0;
}

/*
 * Compute a Neverball perspective projection matrix.
 */
View.prototype.setProjection = function (w, h, fovAngle) {
  var fov = fovAngle * Math.PI / 180;
  var a = w / h;
  var n = 0.1;
  var f = 512.0;

  mat4.perspective(this._projectionMatrix, fov, a, n, f);
};

/*
 * Neverball defaults
 */
View.DP = 0.75;
View.DC = 0.25;
View.DZ = 2.00;

View.SPEED = 2.0;

/*
 * Overhead at position.
 */
View.prototype.overhead = function (p) {
  vec3.set(this.p, p[0], p[1] + View.DP, p[2] + View.DZ);
  vec3.set(this.c, p[0], p[1] + View.DC, p[2]);
};

/*
 * Calculate a basis matrix.
 */
View.prototype.getBasis = (function () {
  // video_calc_view
  var x = vec3.create();
  var y = vec3.create();
  var z = vec3.create();

  return function () {
    vec3.sub(z, this.p, this.c);
    vec3.normalize(z, z);
    vec3.cross(x, this.u, z);
    vec3.normalize(x, x);
    vec3.cross(y, z, x);

    var M = this._basis;

    M[0] = x[0];
    M[1] = x[1];
    M[2] = x[2];

    M[4] = y[0];
    M[5] = y[1];
    M[6] = y[2];

    M[8] = z[0];
    M[9] = z[1];
    M[10] = z[2];

    return this._basis;
  };
})();

/*
 * Calculate the complete view matrix.
 */
View.prototype.getMatrix = (function () {
  // game_draw
  var M = mat4.create();
  var v = vec3.create();

  return function () {
    var viewMat = this._viewMatrix;

    vec3.sub(v, this.c, this.p);
    mat4.fromTranslation(viewMat, vec3.set(v, 0, 0, -vec3.len(v)));
    mat4.multiply(viewMat, viewMat, mat4.transpose(M, this.getBasis()));
    mat4.translate(viewMat, viewMat, vec3.negate(v, this.c));

    return this._viewMatrix;
  };
})();

/*
 * Calculate a fly-in view from the available SOL entities.
 */
View.prototype.setFromSol = (function () {
  // game_view_fly

  var ball = View();
  var view = View();

  return function (sol, k) {
    if (sol.uv.length) {
      ball.overhead(sol.uv[0].p);
    }

    if (k >= 0 && sol.wv.length > 0) {
      vec3.copy(view.p, sol.wv[0].p);
      vec3.copy(view.c, sol.wv[0].q);
    }
    if (k <= 0 && sol.wv.length > 1) {
      vec3.copy(view.p, sol.wv[1].p);
      vec3.copy(view.c, sol.wv[1].q);
    } else if (k <= 0) { // TOOD
      k = 0;
    }

    // Interpolate the views.

    vec3.lerp(this.p, ball.p, view.p, k * k);
    vec3.lerp(this.c, ball.c, view.c, k * k);
  };
})();

/*
 * Rudimentary controls.
 */
View.prototype.moveForward = function (b) {
  this.forward = b;
};

View.prototype.moveBackward = function (b) {
  this.backward = b;
};

View.prototype.moveLeft = function (b) {
  this.left = b;
};

View.prototype.moveRight = function (b) {
  this.right = b;
};

View.prototype.setMoveSpeed = function (dir) {
  if (dir > 0) {
    this.speed = Math.max(View.SPEED, this.speed + View.SPEED);
  } else if (dir < 0) {
    this.speed = Math.max(View.SPEED, this.speed - View.SPEED);
  }
};

View.prototype.step = (function () {
  var v = vec3.create();

  return function (dt) {
    vec3.set(v, 0, 0, 0);

    if (this.forward) {
      v[2] -= this.speed;
    }
    if (this.backward) {
      v[2] += this.speed;
    }
    if (this.left) {
      v[0] -= this.speed;
    }
    if (this.right) {
      v[0] += this.speed;
    }

    if (v[0] || v[2] || v[1]) {
      vec3.transformMat4(v, v, this.getBasis());

      vec3.scale(v, v, dt);
      vec3.add(this.p, this.p, v);
      vec3.add(this.c, this.c, v);
    }
  };
})();

View.prototype.mouseLook = (function () {
  var z = vec3.create();
  var o = vec3.create();

  return function (dx, dy) {
    // dx = rotate around Y
    // dy = rotate around X

    // TODO this does nothing a lot of the time.

    var a = (dx || dy) ? 0.005 : 0.1;
    var filteredDx = (dx * a) + (this._dx * (1.0 - a));
    var filteredDy = (dy * a) + (this._dy * (1.0 - a));
    this._dx = filteredDx;
    this._dy = filteredDy;

    vec3.set(z, 0, 0, 1);
    vec3.set(o, 0, 0, 0);

    if (filteredDx) {
      vec3.rotateY(z, z, o, toRadian(-filteredDx));
    }
    if (filteredDy) {
      vec3.rotateX(z, z, o, toRadian(-filteredDy));
    }

    vec3.transformMat4(z, z, this.getBasis());
    vec3.add(this.c, this.p, vec3.negate(z, z));
  };
})();

},{"gl-matrix":5}]},{},[29]);
