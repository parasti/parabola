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

const F_PENDULUM = 1 << 0;
const F_DRAWBACK = 1 << 1;
const F_DRAWCLIP = 1 << 2;
const F_DEPTHMASK = 1 << 3;
const F_DEPTHTEST = 1 << 4;

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
    return model;
  });

  var innerProm = Solid.fetch(innerPath).then(function(sol) {
    model.inner = new SolidModel(gl, sol);
    model.innerFlags = ballOpts(sol);
    return model;
  });

  var outerProm = Solid.fetch(outerPath).then(function(sol) {
    model.outer = new SolidModel(gl, sol);
    model.outerFlags = ballOpts(sol);
    return model;
  });

  // TODO this is kind of wrong, but we don't know how many layers the model has.
  return Promise.race([solidProm, innerProm, outerProm]);
}

BallModel.prototype.drawInner = function(gl, state, opts) {
  if (this.inner) {
    this.inner.drawBodies(gl, state, opts);
  }
}

BallModel.prototype.drawSolid = function(gl, state, opts) {
  if (this.solid) {
    this.solid.drawBodies(gl, state, opts);
  }
}

BallModel.prototype.drawOuter = function(gl, state, opts) {
  if (this.outer) {
    this.outer.drawBodies(gl, state, opts);
  }
}

BallModel.prototype.passInner = function(gl, state, opts) {
  if (this.innerFlags.drawclip) {
    // TODO
  } else if (this.innerFlags.drawback) {
    gl.cullFace(gl.FRONT);
    this.drawInner(gl, state, opts);
    gl.cullFace(gl.BACK);
    this.drawInner(gl, state, opts);
  } else {
    this.drawInner(gl, state, opts);
  }
}

BallModel.prototype.passSolid = function(gl, state, opts) {
  if (this.solidFlags.drawclip) {
    // TODO
  } else if (this.solidFlags.drawback) {
    gl.cullFace(gl.FRONT);
    this.drawSolid(gl, state, opts);
    gl.cullFace(gl.BACK);

    this.passInner(gl, state, opts);
    this.drawSolid(gl, state, opts);
  } else {
    this.passInner(gl, state, opts);
    this.drawSolid(gl, state, opts);
  }
}

BallModel.prototype.passOuter = function(gl, state, opts) {
  if (this.outerFlags.drawclip) {
    // Sort the outer ball with the solid ball using clip planes.

    // TODO Doable with the near/far planes?
  } else if (this.outerFlags.drawback) {
    // Sort the outer ball with the solid ball using face culling.

    gl.cullFace(gl.FRONT);
    this.drawOuter(gl, state, opts);
    gl.cullFace(gl.BACK);

    this.passSolid(gl, state, opts);
    this.drawOuter(gl, state, opts);
  } else {
    // Draw the outer ball after the solid ball.

    this.passSolid(gl, state, opts);
    this.drawOuter(gl, state, opts);
  }
}

BallModel.prototype.draw = function(gl, state, opts) {
  this.passSolid(gl, state, opts);
}

module.exports = BallModel;