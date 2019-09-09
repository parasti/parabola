'use strict';

var nanoECS = require('nano-ecs');
var EventEmitter = require('events');
var mat4 = require('gl-matrix').mat4;

var SceneNode = require('./scene-node.js');
var View = require('./view.js');
var Mesh = require('./mesh.js');
var EC = require('./entity-components.js');

module.exports = Scene;

function Scene () {
  if (!(this instanceof Scene)) {
    return new Scene();
  }

  this.sceneRoot = SceneNode();

  this.view = View();
  this.time = 0.0;

  // Named SolidModel slots (a SolidModel can be in multiple slots).
  this.models = {
    gradient: null,
    background: null,
    level: null,
    ballInner: null,
    ballSolid: null,
    ballOuter: null,
    coin: null,
    coin5: null,
    coin10: null,
    grow: null,
    shrink: null,
    beam: null,
    jump: null
  };

  // List of all SolidModels.
  this.allModels = [];

  // Entity manager.
  this.entities = nanoECS();

  this._createEntities();

  // Events.
  this.emitter = new EventEmitter();

  // TODO
  this._bodyModels = new Set();
}

Scene.prototype._createSceneEntity = function (modelSlot) {
  var ent = this.entities.createEntity();

  ent.addComponent(EC.SceneGraph);
  ent.addComponent(EC.SceneModel);

  ent.sceneGraph.setParent(this.sceneRoot);
  ent.sceneModel.setSlot(modelSlot);

  return ent;
}

Scene.prototype._createEntities = function () {
  this._createSceneEntity('gradient');
  this._createSceneEntity('background');
  this._createSceneEntity('level');
}

Scene.prototype._addBodyModels = function (solidModel) {
  if (solidModel) {
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      this._bodyModels.add(solidModel.models[i]);
    }
  }
}

Scene.prototype._removeBodyModels = function (solidModel) {
  if (solidModel) {
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      this._bodyModels.delete(solidModel.models[i]);
    }
  }
}

/**
 * Assign a SolidModel to a named slot for use by entities.
 */
Scene.prototype.assignModelSlot = function (modelSlot, solidModel) {
  this._clearModelSlot(modelSlot);
  this._addBodyModels(solidModel);

  this.models[modelSlot] = solidModel;

  this.emitter.emit('model-assigned', modelSlot, solidModel);
}

/**
 * Clear a named slot and remove all model instances from the scene graph.
 */
Scene.prototype._clearModelSlot = function (modelSlot) {
  var sceneRoot = this.sceneRoot;
  var solidModel = this.models[modelSlot];

  if (solidModel) {
    this.models[modelSlot] = null;

    this._removeBodyModels(solidModel);

    // Step 1: remove model instances from the scene graph.

    var instances = solidModel.sceneNode.instances;

    for (var i = 0, n = instances.length; i < n; ++i) {
      var instance = instances[i];
      // Remove if reachable from scene root.
      sceneRoot.removeNode(instance);
    }

    // Step 2: tag all the entities that use this slot.

    var ents = this.entities.queryTag(modelSlot);

    for (var i = 0, n = ents.length; i < n; ++i) {
      var ent = ents[i];
      ent.addTag('needsModel');
    }
  }
};

/**
 * Add SolidModel to our list if not yet added.
 */
Scene.prototype._addModel = function (model) {
  var index = this.allModels.indexOf(model);

  if (index < 0) {
    this.allModels.push(model);
    this.emitter.emit('model-added', model);
  }
};

/*
 * Add a named SolidModel to the scene.
 */
Scene.prototype.setModel = function (state, modelSlot, solidModel) {
  this._addModel(solidModel);

  this.assignModelSlot(modelSlot, solidModel);
};

Scene.prototype.step = function (dt) {
  var scene = this;
  var view = this.view;

  scene.time += dt;

  this.updateSystems(dt);

  view.step(dt);
};

/*
 * Render everything. TODO rework this.
 */
var tmpMat = new Float32Array(16);

Scene.prototype.draw = function (state) {
  var gl = state.gl;

  var bodyModels = this._bodyModels;

  var model, mesh, i, n;

  /*
   * Make arrays of modelview matrices.
   *
   * For each model
   *   instance matrix 0
   *   instance matrix 1
   *   ...
   *   instance matrix N
   */

  for (model of bodyModels) {
    if (!model.instanceVBO) {
      continue;
    }

    var nodes = model.getInstances();

    if (nodes.length) {
      var matrices = new Float32Array(16 * nodes.length);

      for (i = 0, n = nodes.length; i < n; ++i) {
        var node = nodes[i];
        var modelViewMat = matrices.subarray(i * 16, (i + 1) * 16);

        mat4.multiply(modelViewMat, this.view.getMatrix(), node.getWorldMatrix());
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);
      gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
    }
  }

  // Sort meshes.
  /*
   * Massive TODO. Depth sorting is kind of a big topic:
   *  - opaque meshes should be drawn first.
   *  - opaque meshes should be sorted front-to-back to allow for early-Z rejection.
   *  - transparent meshes should be sorted back-to-front for correct visuals.
   *  - due to instanced rendering, a single transparent mesh can be drawn
   *    in multiple places with a single draw call. How do we sort that within
   *    the draw call as well as within the list of all transparent-instanced meshes?
   *    This potentially means splitting a draw call into batches (depth layers?) and
   *    sorting those against all other transparent-instanced batches. Which might mean
   *    that perfect sorting + instancing is less feasible than I hoped. Either we give up
   *    on perfectly sorted visuals or we give up on instancing transparent meshes.
   */

  var meshes = [];

  for (model of bodyModels) {
    if (!model.getInstances().length) {
     continue;
    }

    var modelMeshes = model.meshes;

    for (i = 0, n = modelMeshes.length; i < n; ++i) {
      mesh = modelMeshes[i];
      meshes.push(mesh);
    }
  }

  meshes.sort(Mesh.compare);

  // Set some uniforms.

  state.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;

  // Draw stuff.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (i = 0, n = meshes.length; i < n; ++i) {
    mesh = meshes[i];

    var count = mesh.model.getInstances().length;

    mesh.drawInstanced(state, count);
  }
};

const MOVER_SYSTEM = [EC.Movers, EC.Spatial];
const BILLBOARD_SYSTEM = [EC.Billboard, EC.Spatial];
const SCENEGRAPH_SYSTEM = [EC.Spatial, EC.SceneGraph];

/**
 * Update entity systems.
 */
Scene.prototype.updateSystems = function (dt) {
  var ents, ent, i, n;

  /*
   * Model slot system: attach SolidModels to entities that need them.
   */
  ents = this.entities.queryTag('needsModel');

  for (i = 0, n = ents.length; i < n; ++i) {
    ent = ents[i];

    var modelSlot = ent.sceneModel.slot;
    var model = this.models[modelSlot];

    if (model) {
      model.attachInstance(ent.sceneGraph.node);

      // Here's the weird part: removeTag changes the array we loop over. So, we adjust.

      ent.removeTag('needsModel');

      n = ents.length;
      i = i - 1;
    }
  }

  /*
   * Mover system: get spatial position/orientation from the mover component.
   */
  ents = this.entities.queryComponents(MOVER_SYSTEM);

  for (i = 0, n = ents.length; i < n; ++i) {
    ent = ents[i];

    // Update movers.

    var moverTranslate = ent.movers.translate;
    var moverRotate = ent.movers.rotate;

    if (moverTranslate === moverRotate) {
      moverTranslate.step(dt);
    } else {
      moverTranslate.step(dt);
      moverRotate.step(dt);
    }

    // Update positions.

    // TODO do this only on actual update
    moverTranslate.getPosition(ent.spatial.position);
    moverRotate.getOrientation(ent.spatial.orientation);
  }

  /*
   * Billboard system: get spatial orientation/scale from the billboard component.
   */
  ents = this.entities.queryComponents(BILLBOARD_SYSTEM);

  for (i = 0, n = ents.length; i < n; ++i) {
    ent = ents[i];

    ent.billboard.getTransform(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale, this);
  }

  /*
   * Scene graph system: get scene node matrix from the spatial compontent.
   */
  ents = this.entities.queryComponents(SCENEGRAPH_SYSTEM);

  for (i = 0, n = ents.length; i < n; ++i) {
    ent = ents[i];
    ent.sceneGraph.setMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);
  }
};
