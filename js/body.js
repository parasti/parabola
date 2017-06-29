'use strict';

var vec3 = require('gl-matrix').vec3,
    mat4 = require('gl-matrix').mat4,
    quat = require('gl-matrix').quat;

var Mover = require('./mover.js');

function Body() {
  // TODO not GL related
  this.movers = null;

  this._modelMatrix = mat4.create();

  // All meshes.
  this.meshes = null;

  // Sorted meshes.
  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;
}

Body.prototype.loadMeshes = function(sol) {
  this.meshes = sol.getBodyMeshes(this);
  this.sortMeshes();
}

Body.prototype.sortMeshes = function() {
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

Body.prototype.drawMeshType = function(gl, state, meshType) {
  // String concat for every mesh of every body every frame. Whoo.
  var meshes = this[meshType + 'Meshes'];

  for (var i = 0; i < meshes.length; ++i) {
    meshes[i].draw(gl, state);
  }
}

/*
 * Update mover state.
 */
Body.prototype.step = function(dt) {
  if (!this.movers) {
    return;
  }

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
Body.prototype.getTransform = (function() {
  var p = vec3.create();
  var e = quat.create();

  return function() {
    if (this.movers) {
      this.movers.translate.getPosition(p);
      this.movers.rotate.getOrientation(e);

      return mat4.fromRotationTranslation(this._modelMatrix, e, p);
    } else {
      // TODO
      return mat4.identity(this._modelMatrix);
    }
  }
})();

module.exports = Body;