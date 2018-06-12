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

Scene.prototype.setModel = function (gl, modelName, sol) { // TODO support unloading (sol = null)
  var model = SolidModel.fromSol(sol);
  model.createObjects(gl);
  this.models[modelName] = model;

  // Update scene graph.
  if (modelName === 'level') {
    // Just loaded level model. Attach instances of loaded entity models.
    var levelModel = this.models.level;

    for (var name in this.models) {
      var entModel = this.models[name];

      if (levelModel && entModel && entModel !== levelModel) {
        attachModelToEnts(levelModel, entModel, name);
      }
    }

    // Set level model as the root of the entire scene.
    levelModel.sceneRoot.setParent(this.sceneRoot);
  } else {
    // Just loaded entity model. Attach instances of it to level model.
    var levelModel = this.models.level;
    var entModel = this.models[modelName];

    if (levelModel && entModel) {
      attachModelToEnts(levelModel, entModel, modelName);
    }
  }
};

function attachModelToEnts(levelModel, entModel, tag) {
  var ents = levelModel.entities.queryTag(tag);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var instance = entModel.sceneRoot.createInstance();
    instance.setParent(ents[i].sceneGraph.node);
  }
}

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
  var sortedNodes = sortNodesByModel(new Map(), this.sceneRoot);

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
    return modelNodes;
  }

  for (var i = 0; i < node.children.length; ++i) {
    sortNodesByModel(modelNodes, node.children[i]);
  }

  var model = node.getModel();

  if (model === null) {
    return modelNodes;
  }

  if (modelNodes.has(model)) {
    modelNodes.get(model).push(node);
  } else {
    modelNodes.set(model, [node]);
  }

  return modelNodes;
}
