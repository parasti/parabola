'use strict';

var SceneNode = require('./scene-node.js');
var SolidModel = require('./solid-model.js');
var View = require('./view.js');

module.exports = Scene;

function Scene () {
  if (!(this instanceof Scene)) {
    return new Scene();
  }

  this.sceneRoot = SceneNode();
  this.view = View();

  this.models = {
    level: null,
    ballInner: null,
    ballSolid: null,
    ballOuter: null,
    coin: null,
    coin5: null,
    coin10: null,
    grow: null,
    shrink: null
  };

  this.time = 0.0;
}

Scene.prototype.setModel = function (gl, modelName, sol) {
  var model = SolidModel.fromSol(sol);
  model.createObjects(gl);
  this.models[modelName] = model;
};

Scene.prototype.step = function (dt) {
  this.time += dt;

  for (var name in this.models) {
    var model = this.models[name];

    if (model) {
      model.step(dt);
    }
  }

  this.view.step(dt);
};


/*
 * Render everything. TODO rework this.
 */
Scene.prototype.draw = function (state) {
  var gl = state.gl;
  var shader = state.defaultShader;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (shader.use(gl, state)) {
    shader.uniforms.uTexture.value = 0;
    shader.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;

    var levelModel = this.models.level;

    if (levelModel) {
      //levelModel.drawItems(gl, state);
      levelModel.drawBodies(state);
      //levelModel.drawBalls(gl, this);
      //levelModel.drawBills(gl, this);
    }
  }
};