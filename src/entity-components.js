'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;
var toRadian = require('gl-matrix').glMatrix.toRadian;

var Solid = require('./solid.js');

var EC = module.exports = {};

/*
 * By nano-ECS convention, the function name defines the component name.
 *   componentRef = function componentName () { ... }
 */

/*
 * Model (but I didn't want to type ent.model.model)
 */
EC.Drawable = function drawable () {
  this.model = null;
};

/*
 * Spatial transform
 */
EC.Spatial = function spatial () {
  this.matrix = mat4.create();

  this.position = vec3.create();
  this.orientation = quat.create();
  this.scale = 1;
};

EC.Spatial.prototype.updateMatrix = (function () {
  var s = vec3.create();

  return function () {
    var p = this.position;
    var e = this.orientation;

    vec3.set(s, this.scale, this.scale, this.scale);

    mat4.fromRotationTranslationScale(this.matrix, e, p, s);
  };
})();

/*
 * Path walkers
 */
EC.Movers = function movers () {
  this.translate = null;
  this.rotate = null;
};

/*
 * Item
 */
EC.Item = function item () {
  this.value = 0;
};

/*
 * Billboard
 */
EC.Billboard = function billboard () {
  this.mtrl = null;

  this.time = 1.0;
  this.dist = 0.0;

  this.w = vec3.create();
  this.h = vec3.create();

  this.rx = vec3.create();
  this.ry = vec3.create();
  this.rz = vec3.create();

  this.flags = 0;
};

EC.Billboard.prototype.fromSolBill = function (sol, solBill) {
  this.mtrl = sol.mv[solBill.mi];

  this.time = solBill.t;
  this.dist = solBill.d;

  this.w = solBill.w;
  this.h = solBill.h;

  this.rx = solBill.rx;
  this.ry = solBill.ry;
  this.rz = solBill.rz;

  this.flags = solBill.fl;
};

EC.Billboard.prototype.getForegroundTransform = function (M, globalTime) {
  // sol_bill

  var T = this.time * globalTime;
  var S = Math.sin(T);

  var w = this.w[0] + this.w[1] * T + this.w[2] * S;
  var h = this.h[0] + this.h[1] * T + this.h[2] * S;

  var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * S;
  var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * S;
  var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * S;

  // Preserve passed transform.
  // mat4.identity(M);

  // TODO multiply by view basis.
  // or... can be done by the caller.

  if (rx) mat4.rotateX(M, M, rx / 180.0 * Math.PI);
  if (ry) mat4.rotateY(M, M, ry / 180.0 * Math.PI);
  if (rz) mat4.rotateZ(M, M, rz / 180.0 * Math.PI);

  mat4.scale(M, M, [w, h, 1.0]);

  return M;
};

EC.Billboard.prototype.getBackgroundTransform = function (M, globalTime) {
  var T = this.time > 0 ? globalTime % this.time - this.time / 2 : 0;

  var w = this.w[0] + this.w[1] * T + this.w[2] * T * T;
  var h = this.h[0] + this.h[1] * T + this.h[2] * T * T;

  // TODO Render only billboards facing the viewer.

  if (w > 0 && h > 0) {
    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * T * T;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * T * T;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * T * T;

    if (ry) mat4.rotateY(M, M, toRadian(ry));
    if (rx) mat4.rotateX(M, M, toRadian(rx));

    mat4.translate(M, M, [0, 0, -this.dist]);

    if (this.flags & Solid.BILL_FLAT) {
      mat4.rotateX(M, M, toRadian(-rx - 90));
      mat4.rotateZ(M, M, toRadian(-ry));
    }

    if (this.flags & Solid.BILL_EDGE) {
      mat4.rotateX(M, M, toRadian(-rx));
    }

    if (rz) mat4.rotateZ(M, M, toRadian(rz));

    mat4.scale(M, M, [w, h, 1.0]);
  }

  return M;
};
