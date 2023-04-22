'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat3 = require('gl-matrix').mat3;

var Solid = require('./solid.js');
var SceneNode = require('./scene-node.js');
var Mover = require('./mover.js');

var EC = module.exports = {};

/*
 * By nano-ECS convention, the function name defines the component name.
 *   componentRef = function componentName () { ... }
 */

/*
 * Scene graph node.
 */
EC.SceneGraph = function sceneGraph () {
  this.node = SceneNode();
};

EC.SceneGraph.prototype.setParent = function (node) {
  this.node.setParent(node);
};

EC.SceneGraph.prototype.setLocalMatrix = function (p, e, s) {
  var node = this.node;

  if (node) {
    node.setLocalMatrix(p, e, s);
  }
};

/**
 * Model data.
 */
EC.SceneModel = function sceneModel () {
  this.slot = '';
}

EC.SceneModel.prototype.setSlot = function (modelSlot) {
  if (this.slot) {
    this.entity.removeTag(this.slot);
  }

  this.slot = modelSlot;

  this.entity.addTag(modelSlot);

  // TODO: what if this entity already had a model attached to it?
  // TODO: updateSystems() will have to handle it.
  this.entity.addTag('needsModel');
}

/*
 * Spatial transform
 */
EC.Spatial = function spatial () {
  this.position = vec3.create();
  this.orientation = quat.create();
  this.scale = 1;

  // TODO
  this.dirty = true;
};

/*
 * Path walkers
 */
EC.Movers = function movers () {
  this.translate = null;
  this.rotate = null;
};

EC.Movers.prototype.fromSolBody = function (sol, solBody) {
  var movers = Mover.fromSolBody(sol, solBody);

  this.translate = movers.translate;
  this.rotate = movers.rotate;
};

/*
 * Item
 */
EC.Item = function item () {
  this.value = 0;
};

/*
 * Color
 */
EC.Color = function color () {
  this.color = [1.0, 1.0, 1.0, 1.0];
};

/*
 * Billboard
 */
EC.Billboard = function billboard () {
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

EC.Billboard.prototype.getTransform = function (out_position, out_orientation, out_scale, scene) {
  if (this.flags & Solid.BILL_BACK) {
    this.getBackgroundTransform(out_position, out_orientation, out_scale, scene);
  } else {
    this.getForegroundTransform(out_orientation, out_scale, scene);
  }
}

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

    if (rx) quat.rotateX(Q, Q, rx * Math.PI / 180.0);
    if (ry) quat.rotateY(Q, Q, ry * Math.PI / 180.0);
    if (rz) quat.rotateZ(Q, Q, rz * Math.PI / 180.0);

    quat.copy(out_orientation, Q);
    vec3.set(out_scale, w, h, 1.0);
  };
})();

EC.Billboard.prototype.getBackgroundTransform = (function () {
  var P = vec3.create();
  var Q = quat.create();

  return function (out_position, out_orientation, out_scale, scene) {
    var T = this.time > 0.0 ? (scene.time % this.time) - (this.time / 2.0) : 0.0;

    var w = this.w[0] + this.w[1] * T + this.w[2] * T * T;
    var h = this.h[0] + this.h[1] * T + this.h[2] * T * T;

    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * T * T;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * T * T;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * T * T;

    quat.identity(Q);

    if (ry) quat.rotateY(Q, Q, ry * Math.PI / 180.0);
    if (rx) quat.rotateX(Q, Q, rx * Math.PI / 180.0);

    vec3.set(P, 0, 0, -this.dist);
    vec3.transformQuat(P, P, Q);

    if (this.flags & Solid.BILL_FLAT) {
      quat.rotateX(Q, Q, (-rx - 90.0) * Math.PI / 180.0);
      quat.rotateZ(Q, Q, -ry * Math.PI / 180.0);
    }

    if (this.flags & Solid.BILL_EDGE) {
      quat.rotateX(Q, Q, -rx * Math.PI / 180.0);
    }

    if (rz) quat.rotateZ(Q, Q, rz * Math.PI / 180.0);

    vec3.copy(out_position, P);
    quat.copy(out_orientation, Q);
    vec3.set(out_scale, w, h, 1.0);
  };
})();

EC.Viewpoint = function viewpoint() {
  this.position = vec3.create();
  this.target = vec3.create();
};

EC.Viewpoint.prototype.fromSolView = function (sol, solView) {
  vec3.copy(this.position, solView.p);
  vec3.copy(this.target, solView.q);
};