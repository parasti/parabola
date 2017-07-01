'use strict';

var vec3 = require('gl-matrix').vec3,
    mat4 = require('gl-matrix').mat4,
    quat = require('gl-matrix').quat;

function Entity() {
  this.model = null;

  this.movers = null;
  this.modelMatrix = null;
}

/*
 * Get entity transform from mover state.
 */
Entity.prototype.getTransform = function() {
  return this.modelMatrix;
}

/*
 * Update mover state.
 */
Entity.prototype.step = (function() {
  var p_ = vec3.create();
  var e_ = quat.create();

  return function(dt) {
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

    // TODO do this only on actual update
    moverTranslate.getPosition(p_);
    moverRotate.getOrientation(e_);

    mat4.fromRotationTranslation(this.modelMatrix, e_, p_);
  }
})();

module.exports = Entity;