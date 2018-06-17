'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;

/*
 * Walk the path entities in life. Don't we all.
 */
function Mover (path) {
  if (!(this instanceof Mover)) {
    return new Mover(path);
  }
  this.path = path || null;
  this.time = 0;
}

/*
 * Create movers for a SOL body.
 */
Mover.fromSolBody = function (sol, body) {
  // sol_load_vary()

  var movers = {
    translate: null,
    rotate: null
  };

  movers.translate = Mover(sol.pv[body.pi]);

  if (body.pj === body.pi) {
    movers.rotate = movers.translate;
  } else {
    movers.rotate = Mover(sol.pv[body.pj]);
  }

  return movers;
};

/*
 * Motion easing.
 */
function erp (t) {
  // float erp(float t)
  return 3.0 * t * t - 2.0 * t * t * t;
}

/*
 * Calculate position (optionally after DT seconds).
 */
Mover.prototype.getPosition = function (p, dt = 0.0) {
  // sol_body_p()

  vec3.set(p, 0, 0, 0);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;
    var s;

    if (thisPath.f) {
      s = (this.time + dt) / thisPath.t;
    } else {
      s = this.time / thisPath.t;
    }

    vec3.lerp(p, thisPath.p, nextPath.p, thisPath.s ? erp(s) : s);
  }

  return p;
};

/*
 * Calculate orientation (optionally after DT seconds) as a quaternion.
 */
Mover.prototype.getOrientation = function (e, dt = 0.0) {
  // sol_body_e()

  const P_ORIENTED = 0x1;

  quat.identity(e);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.fl & P_ORIENTED || nextPath.fl & P_ORIENTED) {
      var s;

      if (thisPath.f) {
        s = (this.time + dt) / thisPath.t;
      } else {
        s = this.time / thisPath.t;
      }

      quat.slerp(e, thisPath.e, nextPath.e, thisPath.s ? erp(s) : s);
    }
  }

  return e;
};

/*
 * Walk forward DT seconds.
 */
Mover.prototype.step = function (dt) {
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
};

/*
 * Exports.
 */
module.exports = Mover;
