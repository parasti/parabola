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
  this.velocity = vec3.create();
  this.backward = false;
  this.forward = false;
  this.left = false;
  this.right = false;
};

/*
 * Neverball defaults
 */
View.DP = 0.75;
View.DC = 0.25;
View.DZ = 2.00;

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
View.prototype.getBasis = function () {
  // video_calc_view
  var x = vec3.create();
  var y = vec3.create();
  var z = vec3.create();

  vec3.sub(z, this.p, this.c);
  vec3.normalize(z, z);
  vec3.cross(x, this.u, z);
  vec3.normalize(x, x);
  vec3.cross(y, z, x);

  var M = mat4.create();

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
};

/*
 * Calculate the complete view matrix.
 */
View.prototype.getMatrix = function () {
  // game_draw
  var viewMat = mat4.create();

  var M = mat4.create();
  var v = vec3.create();

  mat4.transpose(M, this.getBasis());
  vec3.sub(v, this.c, this.p);
  mat4.translate(viewMat, viewMat, [0, 0, -vec3.len(v)]);
  mat4.multiply(viewMat, viewMat, M);
  mat4.translate(viewMat, viewMat, vec3.negate(v, this.c));

  return viewMat;
};

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

View.prototype.step = function(dt) {
  var v = this.velocity;

  if (this.forward) {
    v[2] -= 2.0;
  }
  if (this.backward) {
    v[2] += 2.0;
  }
  if (this.left) {
    v[0] -= 2.0;
  }
  if (this.right) {
    v[0] += 2.0;
  }

  if (v[0] || v[2] || v[1]) {
    vec3.transformMat4(v, v, this.getBasis());

    vec3.scale(v, v, dt);
    vec3.add(this.p, this.p, v);
    vec3.add(this.c, this.c, v);
  }
}

/*
 * Exports.
 */
module.exports = View;