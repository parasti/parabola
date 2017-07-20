'use strict';

function BillboardMesh() {
  this.verts = new Float32Array([
    // On edge.
    0.0,  0.0, -0.5,  0.0,
    1.0,  0.0,  0.5,  0.0,
    0.0,  1.0, -0.5,  1.0,
    1.0,  1.0,  0.5,  1.0,

    // Regular.
    0.0,  0.0, -0.5, -0.5,
    1.0,  0.0,  0.5, -0.5,
    0.0,  1.0, -0.5,  0.5,
    1.0,  1.0,  0.5,  0.5,
  ]);
};

BillboardMesh.stride = (2 + 2); // t + n

/*
 * Create and fill a VBO with the mesh vertex data.
 */
BillboardMesh.prototype.createVBO = function (gl) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, this.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  this.vbo = vbo;
};

/*
 * Setup material and draw the mesh.
 */
BillboardMesh.prototype.enableDraw = function(gl, state) {
  state.enableArray(gl, state.aPositionID);
  state.enableArray(gl, state.aTexCoordID);
  state.disableArray(gl, state.aNormalID);  

  if (this.vbo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, BillboardMesh.stride * 4, 0);
    gl.vertexAttribPointer(state.aPositionID, 2, gl.FLOAT, false, BillboardMesh.stride * 4, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}

BillboardMesh.prototype.disableDraw = function(gl, state) {
}

BillboardMesh.prototype.draw = function (gl, state, edge) {
  gl.drawArrays(gl.TRIANGLE_STRIP, edge ? 0 : 4, 4);
};

/*
 * Exports.
 */
module.exports = BillboardMesh;