module.exports = Mesh;

/*
 * Mesh is a fully specified draw call. That's it.
 */
function Mesh () {
  if (!(this instanceof Mesh)) {
    return new Mesh();
  }

  // Texture/state
  this.mtrl = null;

  // Shader program
  this.shader = null;

  // VBO/VAO
  // TODO: this is literally only used to bind a VAO. We don't need an entire model for that.
  this.model = null;

  // Location in the element array.
  this.elemBase = 0;
  this.elemCount = 0;

  // Mesh sort order/draw order.
  this.sortBits = 0;
}

Mesh.prototype.drawInstanced = function (state, count) {
  var gl = state.gl;

  var mesh = this;
  var mtrl = mesh.mtrl;
  var shader = mesh.shader;
  var model = mesh.model;

  // Bind vertex array.
  model.bindArray(state);

  // Apply material state.
  mtrl.draw(state);

  // Bind shader.
  shader.use(state);

  // Update shader globals.
  shader.uploadUniforms(state);

  // PSA: glDrawElements offset is in bytes.
  state.drawElementsInstanced(gl.TRIANGLES, mesh.elemCount, gl.UNSIGNED_SHORT, mesh.elemBase * 2, count);

  state.bindVertexArray(null);
};

var Mtrl = require('./mtrl.js');

/*
 * TODO
 */
Mesh.prototype.defaultSortBits = function () {
  var mesh = this;
  var mtrl = mesh.mtrl;
  var flags = mtrl.flags;

  this.setSortLayer(Mesh.LAYER_FOREGROUND);
  this.setSortBlend((flags & Mtrl.DEPTH_WRITE) ? Mesh.BLEND_OPAQUE : Mesh.BLEND_TRANSPARENT);
};

Mesh.LAYER_GRADIENT = 0;
Mesh.LAYER_BACKGROUND = 1;
Mesh.LAYER_FOREGROUND = 2;

Mesh.BLEND_OPAQUE = 0;
Mesh.BLEND_TRANSPARENT = 1;

Mesh.prototype._setSortBits = function (firstBit, bitLength, value) {
  if (firstBit < 0 || firstBit > 31) {
    throw new Error('Invalid first bit');
  }

  if (bitLength < 1 || firstBit + bitLength > 32) {
    throw new Error ('Invalid bit length');
  }

  var bitShift = 31 - (firstBit + bitLength);
  var bitMask = Math.pow(2, bitLength) - 1;

  this.sortBits = (this.sortBits & ~(bitMask << bitShift)) | (value & bitMask) << bitShift;
}

Mesh.prototype.setSortLayer = function (layer) {
  this._setSortBits(0, 2, layer);
};

Mesh.prototype.setSortBlend = function (blend) {
  this._setSortBits(2, 1, blend);
};

Mesh.prototype.setSortExceptLayer = function (value) {
  this._setSortBits(2, 32 - 2, value);
};

Mesh.compare = function (mesh0, mesh1) {
  var a = mesh0.sortBits;
  var b = mesh1.sortBits;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }

  // Work around unstable sort on Chrome.

  a = mesh0.mtrl.id;
  b = mesh1.mtrl.id;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }
  return 0;
};
