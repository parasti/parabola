'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;

/*
 * Walk the path entities in life. Don't we all.
 */
function Mover(path) {
  this.path = path || null;
  this.time = 0;
}

Mover.fromSolBody = function(sol, body) {
  // sol_load_vary

  var moverTranslate;
  var moverRotate;

  moverTranslate = new Mover(sol.pv[body.pi]);

  if (body.pj === body.pi) {
    moverRotate = moverTranslate;
  } else {
    moverRotate = new Mover(sol.pv[body.pj]);
  }

  return { translate: moverTranslate, rotate: moverRotate };
}

Mover.erp = function(t) {
  // float erp(float t)
  return 3.0 * t * t - 2.0 * t * t * t;
}

/*
 * Calculate position (optionally after DT seconds).
 */
Mover.prototype.getPosition = function(p, dt) {
  // sol_body_p

  var dt = dt || 0.0;

  vec3.set(p, 0, 0, 0);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.f) {
      var s = (this.time + dt) / thisPath.t;
    } else {
      var s = this.time / thisPath.t;
    }

    vec3.lerp(p, thisPath.p, nextPath.p, thisPath.s ? Mover.erp(s) : s);
  }

  return p;
}

/*
 * Calculate orientation (optionally after DT seconds) as a quaternion.
 */
Mover.prototype.getOrientation = function(e, dt) {
  // sol_body_e

  var dt = dt || 0.0;

  quat.identity(e);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.e[3] !== 1.0 || nextPath.e[3] !== 1.0) {
      if (thisPath.f) {
        var s = (this.time + dt) / thisPath.t;
      } else {
        var s = this.time / thisPath.t;
      }

      quat.slerp(e, thisPath.e, nextPath.e, thisPath.s ? Mover.erp(s) : s);
    }
  }

  return e;
}

/*
 * Walk forward DT seconds.
 */
Mover.prototype.step = function(dt) {
  // TODO Count milliseconds to keep time-aware entities in sync.

  if (this.path) {
    var thisPath = this.path;

    if (thisPath.f) {
      this.time += dt;

      if (this.time >= thisPath.t) {
        this.time = 0.0;
        this.path = thisPath.next;
      }
    }
  }
}

/*
 * Exports.
 */
module.exports = Mover;
