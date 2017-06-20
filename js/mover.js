var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;

var Path = require('./solid.js').Path;

/*
 * Walk the path entities in life. Don't we all.
 */
function Mover(path) {
  this.path = path || null;
  this.time = 0;
}

Mover.fromSolBody = function(sol, body) {
  // sol_load_vary
  // TODO figure out how to translate between this and indices in replays.

  var moverTranslate = new Mover(sol.pv[body.pi]);

  // FIXME this breaks stupidly when attempting to step "both" movers.
  // This doesn't occur in Neverball because it walks the global mover array.
  // NOTE Mover index values in replays depend on this.
/*
  if (body.pj === body.pi) {
    var moverRotate = moverTranslate;
  } else {
*/
  var moverRotate = new Mover(sol.pv[body.pj]);

  return [moverTranslate, moverRotate];
}

Mover.erp = function(t) {
  // erp(float t)
  return 3.0 * t * t - 2.0 * t * t * t;
}

Mover.prototype.getPosition = function(p, dt) {
  // sol_body_p

  var dt = dt || 0.0;

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.f) {
      var s = (this.time + dt) / thisPath.t;
    } else {
      var s = this.time / thisPath.t;
    }

    var v = vec3.create();
    vec3.sub(v, nextPath.p, thisPath.p);
    vec3.scaleAndAdd(p, thisPath.p, v, thisPath.s ? Mover.erp(s) : s);
  } else {
    vec3.set(p, 0, 0, 0);
  }

  return p;
}

Mover.prototype.getOrientation = function(e, dt) {
  // sol_body_e

  var dt = dt || 0.0;

  quat.identity(e);

  if (this.path) {
    var thisPath = this.path;
    var nextPath = this.path.next;

    if (thisPath.fl & Path.ORIENTED || nextPath.fl & Path.ORIENTED) {
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
  this.update = false;

  if (this.path) {
    var thisPath = this.path;

    if (thisPath.f) {
      this.time += dt;

      if (this.time >= thisPath.t) {
        this.time = 0.0;
        this.path = thisPath.next;
      }
      
      this.update = true;
    }
  }
}

/*
 * Exports.
 */
module.exports = Mover;
