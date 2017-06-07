'use strict';

var Mesh = function (count, mtrl) {
  this.mtrl = mtrl || null;
  this.verts = count ? new Float32Array(Mesh.stride * count) : null;
  this.count = 0;
};

Mesh.stride = (3 + 3 + 2); // v + n + t

/*
 * Add the given SOL vertex (offs) to the mesh.
 */
Mesh.prototype.addVertFromSol = function (sol, offs) {
  var pos = this.count * Mesh.stride;
  var vert = this.verts.subarray(pos, pos + Mesh.stride);

  sol.getVert(vert, offs);

  this.count++;
};

/*
 * Create and fill a VBO with the mesh vertex data.
 */
Mesh.prototype.createVBO = function (gl) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, this.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  this.vbo = vbo;
};

/*
 * Setup material and draw the mesh.
 */
Mesh.prototype.draw = function (gl, state) {
  this.mtrl.draw(gl, state);

  if (this.vbo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

    gl.vertexAttribPointer(state.positionAttrLoc, 3, gl.FLOAT, false, Mesh.stride * 4, 0);
    gl.vertexAttribPointer(state.normalAttrLoc, 3, gl.FLOAT, false, Mesh.stride * 4, 12);
    gl.vertexAttribPointer(state.texCoordAttrLoc, 2, gl.FLOAT, false, Mesh.stride * 4, 24);

    gl.enableVertexAttribArray(state.positionAttrLoc);
    gl.enableVertexAttribArray(state.normalAttrLoc);
    gl.enableVertexAttribArray(state.texCoordAttrLoc);

    gl.drawArrays(gl.TRIANGLES, 0, this.count);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
};

/*
 * Exports.
 */
module.exports = Mesh;