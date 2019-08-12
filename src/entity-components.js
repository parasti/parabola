'use strict';

var vec3 = require('gl-matrix').vec3;
var vec4 = require('gl-matrix').vec4;
var quat = require('gl-matrix').quat;
var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;
var toRadian = require('gl-matrix').glMatrix.toRadian;

var Solid = require('neverball-solid');
var SceneNode = require('./scene-node.js');

var EC = module.exports = {};

/*
 * By nano-ECS convention, the function name defines the component name.
 *   componentRef = function componentName () { ... }
 */

/*
 * Scene graph node.
 */
EC.SceneGraph = function sceneGraph() {
  this.node = SceneNode();
};

EC.SceneGraph.prototype.setParent = function (node) {
  this.node.setParent(node);
};

EC.SceneGraph.prototype.setModel = function (model) {
  this.node.setModel(model);
};

EC.SceneGraph.prototype.setMatrix = function (p, e, s) {
  var node = this.node;

  if (node) {
    node.setLocalMatrix(p, e, s);
  }
};

/*
 * Spatial transform
 */
EC.Spatial = function spatial() {
  this.position = vec3.create();
  this.orientation = quat.create();
  this.scale = 1;
};

/*
 * Path walkers
 */
EC.Movers = function movers() {
  this.translate = null;
  this.rotate = null;
};

/*
 * Item
 */
EC.Item = function item() {
  this.value = 0;
};

/*
 * Color
 */
EC.Color = function color() {
  this.color = [1.0, 1.0, 1.0, 1.0];
}

/*
 * Billboard
 */
EC.Billboard = function billboard() {
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
  this.time = solBill.t;
  this.dist = solBill.d;

  this.w = solBill.w;
  this.h = solBill.h;

  this.rx = solBill.rx;
  this.ry = solBill.ry;
  this.rz = solBill.rz;

  this.flags = solBill.fl;
};

EC.Billboard.prototype.getForegroundTransform = (function () {
  var Q = quat.create();
  var M = mat3.create();

  return function (out_orientation, out_scale, scene) {
    // sol_bill

    var T = this.time * scene.time;
    var S = Math.sin(T);

    var w = this.w[0] + this.w[1] * T + this.w[2] * S;
    var h = this.h[0] + this.h[1] * T + this.h[2] * S;

    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * S;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * S;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * S;

    if ((this.flags & Solid.BILL_NOFACE)) {
      quat.identity(Q);
    } else {
      mat3.fromMat4(M, scene.view.getBasis());
      quat.fromMat3(Q, M);
      quat.normalize(Q, Q);
    }

    if (Math.abs(rx) > 0.0) quat.rotateX(Q, Q, rx * Math.PI / 180.0);
    if (Math.abs(ry) > 0.0) quat.rotateY(Q, Q, ry * Math.PI / 180.0);
    if (Math.abs(rz) > 0.0) quat.rotateZ(Q, Q, rz * Math.PI / 180.0);

    quat.copy(out_orientation, Q);
    vec3.set(out_scale, w, h, 1.0);
  };
}());

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
