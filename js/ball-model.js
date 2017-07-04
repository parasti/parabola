'use strict';

var Solid = require('./solid.js').Solid;
var SolidModel = require('./solid-model.js');

function BallModel() {
  this.solid = null;
  this.inner = null;
  this.outer = null;

  this.solidFlags = {};
  this.innerFlags = {};
  this.outerFlags = {};
}

function ballOpts(sol) {
  var flags = {};

  flags.pendulum = sol.dv.pendulum === '1';
  flags.drawback = sol.dv.drawback === '1';
  flags.drawclip = sol.dv.drawclip === '1';
  flags.depthmask = sol.dv.depthmask === '1';
  flags.depthtest = sol.dv.depthtest ? sol.dv.depthtest === '1' : true;

  return flags;
}

BallModel.fetch = function(gl, basePath) {
  // TODO json this
  const solidPath = basePath + '-solid.sol';
  const innerPath = basePath + '-inner.sol';
  const outerPath = basePath + '-outer.sol';

  var model = new BallModel();

  var solidProm = Solid.fetch(solidPath).then(function(sol) {
    model.solid = new SolidModel(gl, sol);
    model.solidFlags = ballOpts(sol);
    model.solid.transparentDepthTest = model.solidFlags.depthtest;
    model.solid.transparentDepthMask = model.solidFlags.depthmask;
    return model;
  });

  var innerProm = Solid.fetch(innerPath).then(function(sol) {
    model.inner = new SolidModel(gl, sol);
    model.innerFlags = ballOpts(sol);
    model.inner.transparentDepthTest = model.innerFlags.depthtest;
    model.inner.transparentDepthMask = model.innerFlags.depthmask;
    return model;
  });

  var outerProm = Solid.fetch(outerPath).then(function(sol) {
    model.outer = new SolidModel(gl, sol);
    model.outerFlags = ballOpts(sol);
    model.outer.transparentDepthTest = model.outerFlags.depthtest;
    model.outer.transparentDepthMask = model.outerFlags.depthmask;
    return model;
  });

  // TODO this is sketchy, but we don't know how many layers the model has.
  return Promise.race([solidProm, innerProm, outerProm]);
}

BallModel.prototype.drawInner = function(gl, state, parentMatrix) {
  if (this.inner) {
    this.inner.drawBodies(gl, state, parentMatrix);
  }
}

BallModel.prototype.drawSolid = function(gl, state, parentMatrix) {
  if (this.solid) {
    this.solid.drawBodies(gl, state, parentMatrix);
  }
}

BallModel.prototype.drawOuter = function(gl, state, parentMatrix) {
  if (this.outer) {
    this.outer.drawBodies(gl, state, parentMatrix);
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
  if (this.solid) {
    this.solid.step(dt);
  }
  if (this.inner) {
    this.inner.step(dt);
  }
  if (this.outer) {
    this.outer.step(dt);
  }
}

module.exports = BallModel;