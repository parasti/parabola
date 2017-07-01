'use strict';

var vec3 = require('gl-matrix').vec3,
    mat4 = require('gl-matrix').mat4,
    quat = require('gl-matrix').quat;

var Mover = require('./mover.js');

function BodyModel() {
  this.meshes = null;

  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;

  // TODO not GL related
  this.movers = null;
  this._modelMatrix = mat4.create();
}

BodyModel.fromSolBody = function(sol, solBody) {
  var model = new BodyModel();
  model.meshes = sol.getBodyMeshes(solBody);
  model.sortMeshes();

  // TODO not GL related
  model.movers = Mover.fromSolBody(sol, solBody);

  return model;
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

function drawMeshes(gl, state, meshes) {
  for (var i = 0; i < meshes.length; ++i) {
    meshes[i].draw(gl, state);
  }
}

BodyModel.prototype.drawMeshType = function(gl, state, meshType) {
  gl.uniformMatrix4fv(state.uModelID, false, this.getTransform()); // TODO not model related

  var meshes = this[meshType + 'Meshes'];
  for (var i = 0; i < meshes.length; ++i) {
    meshes[i].draw(gl, state);
  }
}

/*
 * Update mover state.
 */
BodyModel.prototype.step = function(dt) {
  // TODO not GL related
  var moverTranslate = this.movers.translate;
  var moverRotate = this.movers.rotate;

  if (moverTranslate === moverRotate) {
    moverTranslate.step(dt);
  } else {
    moverTranslate.step(dt);
    moverRotate.step(dt);
  }
}

/*
 * Get entity transform from mover state.
 */
BodyModel.prototype.getTransform = (function() {
  var p = vec3.create();
  var e = quat.create();

  return function() {
    this.movers.translate.getPosition(p);
    this.movers.rotate.getOrientation(e);

    return mat4.fromRotationTranslation(this._modelMatrix, e, p);
  }
})();



module.exports = BodyModel;