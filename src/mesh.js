module.exports = Mesh;

/*
 * Mesh is a fully specified draw call.
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
  this.model = null;

  // Location in the element array.
  this.elemBase = 0;
  this.elemCount = 0;

  // Mesh sort key.
  this.sortIndex = 0;
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
Mesh.prototype.createSortKey = function () {
  var mtrl = this.mtrl;
  var flags = mtrl.flags;

  if (flags & Mtrl.DECAL) {
    this.sortIndex |= 0x1;
  }
  if (flags & Mtrl._BLEND) {
    this.sortIndex |= 0x2;
  }
};

Mesh.compare = function (mesh0, mesh1) {
  var a = mesh0.sortIndex;
  var b = mesh1.sortIndex;

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
}