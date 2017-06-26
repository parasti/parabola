'use strict';

var vec3 = require('gl-matrix').vec3,
    mat4 = require('gl-matrix').mat4,
    quat = require('gl-matrix').quat;

var Mover = require('./mover.js');

function BodyModel() {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  this.meshes = null;

  // TODO not GL related
  this.moverTranslate = null;
  this.moverRotate = null;

  this._modelMatrix = mat4.create();

  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;
}

BodyModel.fromSolBody = function(sol, solBody) {
  var body = new BodyModel();

  body.meshes = sol.getBodyMeshes(solBody);

  // TODO not GL related
  var movers = Mover.fromSolBody(sol, solBody);
  body.moverTranslate = movers.translate;
  body.moverRotate = movers.rotate;

  body.sortMeshes();

  return body;
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
  gl.uniformMatrix4fv(state.uModelID, false, this.getTransform());
  drawMeshes(gl, state, this[meshType + 'Meshes']);
}

/*
 * Update mover state.
 */
BodyModel.prototype.step = function(dt) {
  // TODO not GL related
  var moverTranslate = this.moverTranslate;
  var moverRotate = this.moverRotate;

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
    this.moverTranslate.getPosition(p);
    this.moverRotate.getOrientation(e);

    return mat4.fromRotationTranslation(this._modelMatrix, e, p);
  }
})();



module.exports = BodyModel;