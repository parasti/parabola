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