'use strict';

var Solid = require('./solid.js').Solid;
var SolidModel = require('./solid-model.js');

function BallModel() {
  this.solidModel = null;
  this.innerModel = null;
  this.outerModel = null;

  this.solidFlags = {};
  this.innerFlags = {};
  this.outerFlags = {};

  this._solidProm = null;
  this._innerProm = null;
  this._outerProm = null;
}

function ballFlags(sol) {
  var flags = {};

  flags.pendulum = sol.dv.pendulum === '1';
  flags.drawback = sol.dv.drawback === '1';
  flags.drawclip = sol.dv.drawclip === '1';
  flags.depthmask = sol.dv.depthmask === '1';
  flags.depthtest = sol.dv.depthtest ? sol.dv.depthtest === '1' : true;

  return flags;
}

function loadLayerFromSol(sol) {
  var model = SolidModel.fromSol(sol);
  var flags = ballFlags(sol);

  model.transparentDepthTest = flags.depthtest;
  model.transparentDepthMask = flags.depthmask;

  return { model, flags };
}

/*
 * Fetch the ball model layers. Return a promise.
 */
BallModel.fetch = function(basePath) {
  // TODO json this
  const solidPath = basePath + '-solid.sol';
  const innerPath = basePath + '-inner.sol';
  const outerPath = basePath + '-outer.sol';

  var model = new BallModel();

  model._solidProm = Solid.fetch(solidPath).then(function(sol) {
    var layer = loadLayerFromSol(sol);
    model.solidModel = layer.model;
    model.solidFlags = layer.flags;
    return model.solidModel;
  });
  
  model._innerProm = Solid.fetch(innerPath).then(function(sol) {
    var layer = loadLayerFromSol(sol);
    model.innerModel = layer.model;
    model.innerFlags = layer.flags;
    return model.innerModel;
  });

  model._outerProm = Solid.fetch(outerPath).then(function(sol) {
    var layer = loadLayerFromSol(sol);
    model.outerModel = layer.model;
    model.outerFlags = layer.flags;
    return model.outerModel;
  });

  return Promise.resolve(model); // TODO Yup.
}

/*
 * Asynchronously create GL resources for any fetched SOLs.
 */
BallModel.prototype.createObjects = function(gl) {
  function createModelObjects(model) {
    model.createObjects(gl);
  }

  this._solidProm.then(createModelObjects);
  this._innerProm.then(createModelObjects);
  this._outerProm.then(createModelObjects);
}

BallModel.prototype.drawInner = function(gl, state, parentMatrix) {
  // TODO billboards
  if (this.innerModel) {
    this.innerModel.drawBodies(gl, state, parentMatrix);
  }
}

BallModel.prototype.drawSolid = function(gl, state, parentMatrix) {
  if (this.solidModel) {
    this.solidModel.drawBodies(gl, state, parentMatrix);
  }
}

BallModel.prototype.drawOuter = function(gl, state, parentMatrix) {
  if (this.outerModel) {
    this.outerModel.drawBodies(gl, state, parentMatrix);
  }
}

BallModel.prototype.passInner = function(gl, state, parentMatrix) {
  if (this.innerFlags.drawclip) {
    // TODO
    this.drawInner(gl, state, parentMatrix);
  } else if (this.innerFlags.drawback) {
    gl.cullFace(gl.FRONT);
    this.drawInner(gl, state, parentMatrix);
    gl.cullFace(gl.BACK);
    this.drawInner(gl, state, parentMatrix);
  } else {
    this.drawInner(gl, state, parentMatrix);
  }
}

BallModel.prototype.passSolid = function(gl, state, parentMatrix) {
  if (this.solidFlags.drawclip) {
    // TODO
    this.passInner(gl, state, parentMatrix);
    this.drawSolid(gl, state, parentMatrix);
  } else if (this.solidFlags.drawback) {
    gl.cullFace(gl.FRONT);
    this.drawSolid(gl, state, parentMatrix);
    gl.cullFace(gl.BACK);

    this.passInner(gl, state, parentMatrix);
    this.drawSolid(gl, state, parentMatrix);
  } else {
    this.passInner(gl, state, parentMatrix);
    this.drawSolid(gl, state, parentMatrix);
  }
}

BallModel.prototype.passOuter = function(gl, state, parentMatrix) {
  if (this.outerFlags.drawclip) {
    // Sort the outer ball with the solid ball using clip planes.

    // TODO Doable with the near/far planes?

    this.passSolid(gl, state, parentMatrix);
    this.drawOuter(gl, state, parentMatrix);
  } else if (this.outerFlags.drawback) {
    // Sort the outer ball with the solid ball using face culling.

    gl.cullFace(gl.FRONT);
    this.drawOuter(gl, state, parentMatrix);
    gl.cullFace(gl.BACK);

    this.passSolid(gl, state, parentMatrix);
    this.drawOuter(gl, state, parentMatrix);
  } else {
    // Draw the outer ball after the solid ball.

    this.passSolid(gl, state, parentMatrix);
    this.drawOuter(gl, state, parentMatrix);
  }
}

BallModel.prototype.draw = function(gl, state, parentMatrix) {
  this.passOuter(gl, state, parentMatrix);
}

BallModel.prototype.step = function(dt) {
  if (this.solidModel) {
    this.solidModel.step(dt);
  }
  if (this.innerModel) {
    this.innerModel.step(dt);
  }
  if (this.outerModel) {
    this.outerModel.step(dt);
  }
}

module.exports = BallModel;