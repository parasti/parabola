'use strict';

module.exports = BodyModel;

function BodyModel() {
  this.meshes = null;

  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;
}

BodyModel.fromSolBody = function(sol, solBody) {
  var model = new BodyModel();
  model.meshes = sol.getBodyMeshes(solBody);
  model.sortMeshes();
  return model;
}

BodyModel.prototype.createObjects = function(gl) {
  var meshes = this.meshes;

  for (var j = 0; j < meshes.length; ++j) {
    var mesh = meshes[j];
    createMeshObjects(gl, mesh);
  }
}

BodyModel.prototype.sortMeshes = function() {
  var opaqueMeshes = [];
  var opaqueDecalMeshes = [];
  var transparentDecalMeshes = [];
  var transparentMeshes = [];
  var reflectiveMeshes = [];

  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (mtrl.isOpaque()) {
      opaqueMeshes.push(mesh);
    } else if (mtrl.isOpaqueDecal()) {
      opaqueDecalMeshes.push(mesh);
    } else if (mtrl.isTransparentDecal()) {
      transparentDecalMeshes.push(mesh);
    } else if (mtrl.isTransparent()) {
      transparentMeshes.push(mesh);
    } else if (mtrl.isReflective()) {
      reflectiveMeshes.push(mesh);
    }
  }

  this.opaqueMeshes = opaqueMeshes;
  this.opaqueDecalMeshes = opaqueDecalMeshes;
  this.transparentDecalMeshes = transparentDecalMeshes;
  this.transparentMeshes = transparentMeshes;
  this.reflectiveMeshes = reflectiveMeshes;
}

BodyModel.prototype.drawMeshType = function(gl, state, meshType) {
  var meshes = this[meshType + 'Meshes'];
  for (var i = 0; i < meshes.length; ++i) {
    drawMesh(gl, state, meshes[i]);
  }
}

/*
 * Mesh rendering.
 */
function createMeshObjects(gl, mesh) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  mesh.vbo = vbo;
}

function drawMesh(gl, state, mesh) {
  mesh.mtrl.draw(gl, state);

  if (mesh.vbo) {
    state.enableArray(gl, state.uPositionID);
    state.enableArray(gl, state.aNormalID);
    state.enableArray(gl, state.aTexCoordID);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
}