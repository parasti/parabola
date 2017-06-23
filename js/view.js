'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;

var View = function (p, c) {
  if (p && c) {
    this.p = vec3.clone(p);
    this.c = vec3.clone(c);
  } else if (p) {
    this.overhead(p);
  } else {
    this.overhead([0, 0, 0]);
  }
  this.u = vec3.fromValues(0, 1, 0);

  // TODO
  this.speed = View.SPEED;
  this.backward = false;
  this.forward = false;
  this.left = false;
  this.right = false;
  this.dx = 0.0;
  this.dy = 0.0;
};

/*
 * Neverball defaults
 */
View.DP = 0.75;
View.DC = 0.25;
View.DZ = 2.00;

View.SPEED = 2.0;

/*
 * Overhead at position.
 */
View.prototype.overhead = function(p) {
  this.p = vec3.fromValues(p[0], p[1] + View.DP, p[2] + View.DZ);
  this.c = vec3.fromValues(p[0], p[1] + View.DC, p[2]);
}

/*
 * Calculate a basis matrix.
 */
View.prototype.getBasis = (function () {
  // video_calc_view
  var x = vec3.create();
  var y = vec3.create();
  var z = vec3.create();

  var M = mat4.create();

  return function () {
    vec3.sub(z, this.p, this.c);
    vec3.normalize(z, z);
    vec3.cross(x, this.u, z);
    vec3.normalize(x, x);
    vec3.cross(y, z, x);

    M[0] = x[0];
    M[1] = x[1];
    M[2] = x[2];

    M[4] = y[0];
    M[5] = y[1];
    M[6] = y[2];

    M[8]  = z[0];
    M[9]  = z[1];
    M[10] = z[2];

    return M;
  }
})();

/*
 * Calculate the complete view matrix.
 */
View.prototype.getMatrix = (function () {
  // game_draw
  var viewMat = mat4.create();

  var M = mat4.create();
  var v = vec3.create();

  return function() {
    vec3.sub(v, this.c, this.p);
    mat4.fromTranslation(viewMat, vec3.set(v, 0, 0, -vec3.len(v)));
    mat4.multiply(viewMat, viewMat, mat4.transpose(M, this.getBasis()));
    mat4.translate(viewMat, viewMat, vec3.negate(v, this.c));
    return viewMat;
  }
})();

/*
 * Rudimentary controls.
 */
View.prototype.moveForward = function(b) {
  this.forward = b;
}

View.prototype.moveBackward = function(b) {
  this.backward = b;
}

View.prototype.moveLeft = function(b) {
  this.left = b;
}

View.prototype.moveRight = function(b) {
  this.right = b;
}

View.prototype.moveSpeed = function(dir) {
  if (dir > 0) {
    this.speed = Math.max(View.SPEED, this.speed + View.SPEED);
  } else if (dir < 0) {
    this.speed = Math.max(View.SPEED, this.speed - View.SPEED);
  }
}

View.prototype.step = (function() {
  var v = vec3.create();

  return function(dt) {
    vec3.set(v, 0, 0, 0);

    if (this.forward) {
      v[2] -= this.speed;
    }
    if (this.backward) {
      v[2] += this.speed;
    }
    if (this.left) {
      v[0] -= this.speed;
    }
    if (this.right) {
      v[0] += this.speed;
    }

    if (v[0] || v[2] || v[1]) {
      vec3.transformMat4(v, v, this.getBasis());

      vec3.scale(v, v, dt);
      vec3.add(this.p, this.p, v);
      vec3.add(this.c, this.c, v);
    }
  }
})();

var toRadian = require('gl-matrix').glMatrix.toRadian;

View.prototype.mouseLook = function(_dx, _dy) {
  // dx = rotate around Y
  // dy = rotate around X

  var a = (_dx || _dy) ? 0.005 : 0.1;
  var dx = (_dx * a) + (this.dx * (1.0 - a));
  var dy = (_dy * a) + (this.dy * (1.0 - a));
  this.dx = dx;
  this.dy = dy;

  var M = this.getBasis();

  if (dx) {
    mat4.rotateY(M, M, toRadian(-dx));
  }
  if (dy) {
    mat4.rotateX(M, M, toRadian(-dy));
  }

  var z = vec3.fromValues(M[8], M[9], M[10]);
  vec3.add(this.c, this.p, vec3.negate(z, z));
}

/*
 * Exports.
 */
module.exports = View;