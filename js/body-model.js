'use strict';

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
    mesh.createVBO(gl);
    // TODO Keep a list of materials
    mesh.mtrl.loadTexture(gl);
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
    meshes[i].draw(gl, state);
  }
}

module.exports = BodyModel;