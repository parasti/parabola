'use strict';

var glMatrix = require('gl-matrix');

var vec3 = glMatrix.vec3;
var mat4 = glMatrix.mat4;

var View = function (p, c) {
  this.p = (p && vec3.clone(p) || vec3.fromValues(0, View.DC, 0));
  this.c = (c && vec3.clone(c) || vec3.fromValues(0, View.DP, View.DZ));
  this.u = vec3.fromValues(0, 1, 0);
};

View.DP = 0.75;
View.DC = 0.25;
View.DZ = 2.00;

/*
 * Calculate a matrix from the view.
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

  /* Has auto-formatting botched this yet? */

  M[0] = x[0];
  M[4] = y[0];
  M[8 ] = z[0];
  M[1] = x[1];
  M[5] = y[1];
  M[9 ] = z[1];
  M[2] = x[2];
  M[6] = y[2];
  M[10] = z[2];

  return M;
};

/*
 * TODO
 */
View.prototype.getModelView = function () {
  // game_draw
  var modelView = mat4.create();

  var M = mat4.create();
  var v = vec3.create();

  mat4.transpose(M, this.getBasis());
  vec3.sub(v, this.c, this.p);
  mat4.translate(modelView, modelView, [0, 0, -vec3.len(v)]);
  mat4.multiply(modelView, modelView, M);
  mat4.translate(modelView, modelView, vec3.negate(v, this.c));

  return modelView;
};

/*
 * Exports.
 */
module.exports = View;