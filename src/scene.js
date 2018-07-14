'use strict';

var mat4 = require('gl-matrix').mat4;

var SceneNode = require('./scene-node.js');
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

Scene.prototype._attachModelInstances = function (modelName) {
  var levelModel, entModel;

  if (modelName === 'level') {
    // Just loaded level model. Attach instances of loaded entity models.
    levelModel = this.models.level;

    for (var name in this.models) {
      entModel = this.models[name];

      if (levelModel && entModel && entModel !== levelModel) {
        levelModel.attachModelToEnts(entModel, name);
      }
    }

    // Set level model as the root of the entire scene.
    // TODO why here?
    levelModel.sceneRoot.setParent(this.sceneRoot);
  } else {
    // Just loaded entity model. Attach instances of it to level model.
    levelModel = this.models.level;
    entModel = this.models[modelName];

    if (levelModel && entModel) {
      levelModel.attachModelToEnts(entModel, modelName);
    }
  }
};

Scene.prototype.setModel = function (state, modelName, model) { // TODO support unloading (sol = null)
  this.models[modelName] = model;

  // TODO should this be done dynamically as part of draw()?
  // "Hey, this should have a model, oh, here's a model, let's attach it"
  this._attachModelInstances(modelName);
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

  var i, n;

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
    if (!model.instanceVBO) {
      continue;
    }

    var nodes = sortedNodes.get(model);
    var matrices = new Float32Array(16 * nodes.length);

    for (i = 0, n = nodes.length; i < n; ++i) {
      var node = nodes[i];
      var modelViewMat = matrices.subarray(i * 16, (i + 1) * 16);

      mat4.multiply(modelViewMat, this.view.getMatrix(), node.getWorldMatrix());
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
  }

  // Sort meshes.

  var meshes = [];

  for (model of sortedNodes.keys()) {
    nodes = sortedNodes.get(model);

    var count = nodes.length;
    var modelMeshes = model.meshes;

    for (i = 0, n = modelMeshes.length; i < n; ++i) {
      var mesh = modelMeshes[i];
      mesh._instanceCount = count;
      meshes.push(mesh);
    }
  }

  meshes.sort(compareMeshes);

  // Set some uniforms.

  state.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;

  // Draw stuff.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (i = 0, n = meshes.length; i < n; ++i) {
    var mesh = meshes[i];
    var count = mesh._instanceCount;
    mesh.drawInstanced(state, count);
  }
};

function compareMeshes (mesh0, mesh1) {
  var a = mesh0.sortIndex;
  var b = mesh1.sortIndex;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }

  // Work around unstable sort on Chrome.

  a = mesh0.mtrl.id;
  b = mesh1.mtrl.id;

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return +1;
  }
  return 0;
}

/*
 * Fill a map with scene nodes keyed by model.
 */
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
