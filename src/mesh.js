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
  this.sortOrder = 0;
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
Mesh.prototype.createSortOrder = function () {
  var mesh = this;
  var mtrl = mesh.mtrl;
  var flags = mtrl.flags;

  this.setLayer(Mesh.LAYER_FOREGROUND);
  this.setBlend((flags & Mtrl._DEPTH_WRITE) ? Mesh.BLEND_OPAQUE : Mesh.BLEND_TRANSPARENT);
};

Mesh.LAYER_GRADIENT = 0;
Mesh.LAYER_BACKGROUND = 1;
Mesh.LAYER_FOREGROUND = 2;

Mesh.BLEND_OPAQUE = 0;
Mesh.BLEND_TRANSPARENT = 1;

Mesh.prototype.setSortBits = function (firstBit, bitLength, value) {
  if (firstBit < 0 || firstBit > 31) {
    throw new Error('Invalid first bit');
  }

  if (bitLength < 1 || firstBit + bitLength > 32) {
    throw new Error ('Invalid bit length');
  }

  var bitShift = 31 - (firstBit + bitLength);
  var bitMask = Math.pow(2, bitLength) - 1;

  console.log('bits ' + (bitShift + bitLength) + ':' + (bitShift + 1) + ' = ' + value);

  this.sortOrder = (this.sortOrder & ~(bitMask << bitShift)) | (value & bitMask) << bitShift;
}

Mesh.prototype.setLayer = function (layer) {
  this.setSortBits(15, 2, layer);
}

Mesh.prototype.setBlend = function (blend) {
  this.setSortBits(17, 1, blend);
}

Mesh.compare = function (mesh0, mesh1) {
  var a = mesh0.sortOrder;
  var b = mesh1.sortOrder;

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
