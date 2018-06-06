'use strict';

var mat4 = require('gl-matrix').mat4;

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

  if (modelName === 'level') {
    model.sceneRoot.setParent(this.sceneRoot);
  }

  var levelAndCoins = ((this.models.level && modelName === 'coin') ||
                       (this.models.coin && modelName === 'level'));

  if (levelAndCoins) {
    // Add coin model instances
    var levelModel = this.models.level;
    var coinModel = this.models.coin;
    var ents = levelModel.entities.queryTag('coin');

    for (var i = 0; i < ents.length; ++i) {
      var coinInstance = coinModel.sceneRoot.createInstance();
      coinInstance.setParent(ents[i].sceneGraph.node);
    }
  }
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

  /*
   * Make lists of nodes, indexed by model.
   */

  var sortedNodes = new Map();
  sortNodesByModel(sortedNodes, this.sceneRoot);

  /*
   * Make arrays of modelview matrices.
   *
   * 1 array per model,
   * n matrices per array, where
   * n is the number of nodes that use this model.
   */

  var bodyModels = sortedNodes.keys();

  for (var model of bodyModels) {
    var nodes = sortedNodes.get(model);
    // Interleaved modelview and normal matrices.
    var matrices = new Float32Array(16 * nodes.length);

    for (var j = 0; j < nodes.length; ++j) {
      var node = nodes[j];
      var modelViewMat = matrices.subarray(j * 16, (j + 1) * 16);

      mat4.multiply(modelViewMat, this.view.getMatrix(), node.getWorldMatrix());
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (shader.use(gl, state)) {
    shader.uniforms.uTexture.value = 0;
    shader.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;

    for (model of sortedNodes.keys()) {
      nodes = sortedNodes.get(model);
      model.drawInstanced(state, nodes.length);
    }
  }
};

function sortNodesByModel (modelNodes, node) {
  if (!node) {
    return;
  }

  for (var i = 0; i < node.children.length; ++i) {
    sortNodesByModel(modelNodes, node.children[i]);
  }

  var data = node.getData();

  if (data === null) {
    return;
  }

  var model = data;

  if (modelNodes.has(model)) {
    modelNodes.get(model).push(node);
  } else {
    modelNodes.set(model, [node]);
  }
}
