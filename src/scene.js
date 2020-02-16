'use strict';

var nanoECS = require('nano-ecs');
var EventEmitter = require('events');
var mat4 = require('gl-matrix').mat4;

var SceneNode = require('./scene-node.js');
var View = require('./view.js');
var Mesh = require('./mesh.js');
var EC = require('./entity-components.js');
var utils = require('./utils.js');

module.exports = Scene;

function Scene() {
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

  this._createWorldEntities();

  // Events.
  this.emitter = new EventEmitter();

  // TODO
  this._bodyModels = [];
  this._meshes = [];

  // TODO this is a tough one.
  // Key: BodyModel
  // Value: model.sceneNode instances reachable from this.sceneRoot.
  // Reason: so that we do not draw rogue instances that aren't actually attached to the scene graph.
  this._reachableInstances = new Map();
  this._instanceMatrices = new Map();
  this._modelSceneNodes = Object.create(null);
}

Scene.prototype._createWorldEntity = function (modelSlot) {
  var ent = this.entities.createEntity();

  ent.addComponent(EC.SceneGraph);
  ent.addComponent(EC.SceneModel);

  // ent.sceneGraph.setParent(this.sceneRoot);
  ent.sceneModel.setSlot(modelSlot);

  return ent;
}

Scene.prototype._createWorldEntities = function () {
  this._createWorldEntity('gradient');
  this._createWorldEntity('background');
  this._createWorldEntity('level');
}

/**
 * Make a list of BodyModel scene node instances reachable from scene root.
 *
 * We're not walking the scene graph, because the nodes actually
 * have no idea about the model (or whatever) that owns them.
 */
Scene.prototype._updateReachableInstances = function () {
  var bodyModels = this._bodyModels;

  for (var bodyModelIndex = 0, bodyModelCount = bodyModels.length; bodyModelIndex < bodyModelCount; ++bodyModelIndex) {
    var bodyModel = bodyModels[bodyModelIndex];
    var reachableInstances = [];

    for (var instanceIndex = 0, instanceCount = bodyModel.sceneNode.instances.length; instanceIndex < instanceCount; ++instanceIndex) {
      var instance = bodyModel.sceneNode.instances[instanceIndex];

      if (instance.hasAncestor(this.sceneRoot)) {
        reachableInstances.push(instance);
      }
    }

    for (var meshIndex = 0, meshCount = bodyModel.meshes.length; meshIndex < meshCount; ++meshIndex) {
      var mesh = bodyModel.meshes[meshIndex];
      mesh.instanceCount = reachableInstances.length;
    }

    this._reachableInstances.set(bodyModel, reachableInstances);
    this._instanceMatrices.set(bodyModel, new Float32Array(reachableInstances.length * 16));
  }
};

Scene.prototype._addBodyModels = function (solidModel) {
  if (solidModel) {
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      var bodyModel = solidModel.models[i];

      if (this._bodyModels.indexOf(bodyModel) < 0) {
        this._bodyModels.push(bodyModel);

        this._addMeshes(bodyModel.meshes);
      }
    }
  }
}

Scene.prototype._removeBodyModels = function (solidModel) {
  if (solidModel) {
    // FIXME: when a SolidModel is in multiple slots, this removes all of them. Bummer.
    for (var i = 0, n = solidModel.models.length; i < n; ++i) {
      var bodyModel = solidModel.models[i];
      var index = this._bodyModels.indexOf(bodyModel);

      if (index >= 0) {
        this._bodyModels.splice(index, 1);

        this._removeMeshes(bodyModel.meshes);
      }
    }
  }
}

Scene.prototype._addMeshes = function (meshes) {
  Array.prototype.push.apply(this._meshes, meshes);
}

Scene.prototype._removeMeshes = function (meshes) {
  for (var i = 0, n = meshes.length; i < n; ++i) {
    var mesh = meshes[i];
    var index = this._meshes.indexOf(mesh);

    if (index >= 0) {
      this._meshes.splice(index, 1);
    }
  }
}

/**
 * Assign a SolidModel to a named slot for use by entities.
 */
Scene.prototype.assignModelSlot = function (modelSlot, solidModel) {
  this._clearModelSlot(modelSlot);

  // Note: the SolidModel is inserted in the scene graph by the ECS.

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

/**
 * Make arrays of modelview matrices.
 *
 * For each model
 *   instance matrix 0
 *   instance matrix 1
 *   ...
 *   instance matrix N
 *
 * Arrays of instance matrix data are uploaded to VBOs for instanced rendering.
 */
Scene.prototype._uploadModelViewMatrices = (function () {
  var M = mat4.create();

  return function (state) {
    var gl = state.gl;

    var viewMatrix = this.view.getMatrix();

    for (var [bodyModel, instances] of this._reachableInstances) {
      var meshData = bodyModel.meshData;

      if (!meshData) {
        continue;
      }

      if (!meshData.instanceVBO) {
        continue;
      }

      if (!instances.length) {
        continue;
      }

      var instanceMatrices = this._instanceMatrices.get(bodyModel);

      for (var instanceIndex = 0, instanceCount = instances.length; instanceIndex < instanceCount; ++instanceIndex) {
        var instance = instances[instanceIndex];
        var worldMatrix = instance.getWorldMatrix();

        mat4.multiply(M, viewMatrix, worldMatrix);
        utils.mat4_copyToOffset(instanceMatrices, instanceIndex * 16, M);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);
      gl.bufferData(gl.ARRAY_BUFFER, instanceMatrices, gl.DYNAMIC_DRAW);
    }
  };
})();

Scene.prototype.draw = function (state) {
  this._uploadModelViewMatrices(state);

  Mesh.sortMeshes(this._meshes);

  // Set some uniforms.

  state.uniforms.ProjectionMatrix.value = this.view._projectionMatrix;

  // Draw stuff.

  this._drawFrame(state, this._meshes);
};

Scene.prototype._drawFrame = function (state, meshes) {
  var gl = state.gl;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (var i = 0, n = meshes.length; i < n; ++i) {
    var mesh = meshes[i];

    if (mesh.instanceCount === 0) {
      break;
    }

    mesh.draw(state);
  }
};

var MOVER_SYSTEM = [EC.Movers, EC.Spatial];
var BILLBOARD_SYSTEM = [EC.Billboard, EC.Spatial];
var SCENEGRAPH_SYSTEM = [EC.Spatial, EC.SceneGraph];

/**
 * Model slot system: attach SolidModels to entities that need them.
 */
Scene.prototype._updateModelSlots = function () {
  var ents = this.entities.queryTag('needsModel');

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    var modelSlot = ent.sceneModel.slot;
    var solidModel = this.models[modelSlot];

    if (solidModel) {
      // This is all very complicated.

      var instance = ent.sceneGraph.node.createInstance();
      instance.setParent(this.sceneRoot);
      solidModel.attachInstance(instance);

      // Here's the weird part: removeTag changes the array we loop over. So, we adjust.

      ent.removeTag('needsModel');

      n = ents.length;
      i = i - 1;
    }
  }

  this._updateReachableInstances();
}

/**
 * Mover system: get spatial position/orientation from the mover component.
 */
Scene.prototype._updateMovers = function (dt) {
  var ents = this.entities.queryComponents(MOVER_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

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

    ent.spatial.dirty = true;
  }
}

/**
 * Billboard system: get spatial orientation/scale from the billboard component.
 */
Scene.prototype._updateBillboards = function () {
  var ents = this.entities.queryComponents(BILLBOARD_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    ent.billboard.getTransform(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale, this);

    ent.spatial.dirty = true;
  }
}

/**
 * Scene graph system: get scene node matrix from the spatial compontent.
 */
Scene.prototype._updateSceneGraph = function () {
  var ents = this.entities.queryComponents(SCENEGRAPH_SYSTEM);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var ent = ents[i];

    if (ent.spatial.dirty) {
      ent.sceneGraph.setLocalMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);

      ent.spatial.dirty = false;
    }
  }
}

/**
 * Update entity systems.
 */
Scene.prototype.updateSystems = function (dt) {
  this._updateModelSlots();
  this._updateMovers(dt);
  this._updateBillboards();
  this._updateSceneGraph();
};
