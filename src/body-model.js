'use strict';

module.exports = BodyModel;

var Mtrl = require('./mtrl.js');

function BodyModel () {
  var model = Object.create(BodyModel.prototype);
  model.meshes = null; // Both array and dictionary
  return model;
}

BodyModel.fromSolBody = function (sol, solBody) {
  var model = BodyModel();
  model.meshes = sol.getBodyMeshes(solBody);
  model.sortMeshes();
  return model;
};

BodyModel.prototype.createObjects = function (gl) {
  var meshes = this.meshes;

  for (var i = 0; i < meshes.length; ++i) {
    var mesh = meshes[i];
    createMeshObjects(gl, mesh);
  }
};

BodyModel.prototype.sortMeshes = function () {
  var opaqueMeshes = this.meshes.opaque = [];
  var opaqueDecalMeshes = this.meshes.opaqueDecal = [];
  var transparentDecalMeshes = this.meshes.transparentDecal = [];
  var transparentMeshes = this.meshes.transparent = [];
  var reflectiveMeshes = this.meshes.reflective = [];

  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (Mtrl.isOpaque(mtrl)) {
      opaqueMeshes.push(mesh);
    } else if (Mtrl.isOpaqueDecal(mtrl)) {
      opaqueDecalMeshes.push(mesh);
    } else if (Mtrl.isTransparentDecal(mtrl)) {
      transparentDecalMeshes.push(mesh);
    } else if (Mtrl.isTransparent(mtrl)) {
      transparentMeshes.push(mesh);
    } else if (Mtrl.isReflective(mtrl)) {
      reflectiveMeshes.push(mesh);
    }
  }
};

BodyModel.prototype.drawMeshType = function (gl, state, meshType) {
  var meshes = this.meshes[meshType];
  for (var i = 0; i < meshes.length; ++i) {
    drawMesh(gl, state, meshes[i]);
  }
};

/*
 * Mesh rendering.
 */
function createMeshObjects (gl, mesh) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  mesh.vbo = vbo;

  var ebo = gl.createBuffer();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.elems, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  mesh.ebo = ebo;
}

function drawMesh (gl, state, mesh) {
  Mtrl.draw(gl, state, mesh.mtrl);

  state.defaultShader.uploadUniforms(gl);

  if (mesh.vbo) {
    state.enableArray(gl, state.aPositionID);
    state.enableArray(gl, state.aNormalID);
    state.enableArray(gl, state.aTexCoordID);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
    gl.drawElements(gl.TRIANGLES, mesh.elems.length, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
}
