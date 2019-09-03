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

  // Events.
  this.emitter = new EventEmitter();
}

/**
 * Parent SolidModel scene-node instances to scene-nodes of tagged entities.
 */
Scene.prototype.attachModelToEnts = function (model, tag) {
  var ents = this.entities.queryTag(tag);

  for (var i = 0, n = ents.length; i < n; ++i) {
    var instance = model.sceneNode.createInstance();
    instance.setParent(ents[i].sceneGraph.node);
  }
};

/**
 * Insert entity model scene-node into the level model scene-graph.
 *
 * TODO this is messy.
 * Level model ends up with a contaminated scene graph.
 * Should it be instanced first?
 */
Scene.prototype._attachModelInstances = function (modelName) {
  var levelModel, entModel;

  if (modelName === 'level') {
    // Just loaded level model. Attach instances of loaded entity models.
    levelModel = this.models.level;

    for (var name in this.models) {
      entModel = this.models[name];

      if (levelModel && entModel && entModel !== levelModel) {
        this.attachModelToEnts(entModel, name);
      }
    }

    // Set level model as the root of the entire scene.
    // TODO why here?
    // TODO the draw routine just ignores this.sceneRoot anyway.
    // levelModel.sceneNode.setParent(this.sceneRoot);
  } else {
    // Just loaded entity model. Attach instances of it to level model.
    levelModel = this.models.level;
    entModel = this.models[modelName];

    if (levelModel && entModel) {
      this.attachModelToEnts(entModel, modelName);
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
 * TODO this does two things: maintains a list + adds the model to the rendered scene.
 * TODO Maybe it should do only one of those.
 */
Scene.prototype.setModel = function (state, modelName, model) {
  this._addModel(model);

  this.models[modelName] = model;
  this.emitter.emit('model-assigned', model, modelName);

  this._attachModelInstances(modelName);
};

Scene.prototype.step = function (dt) {
  var scene = this;
  var view = this.view;

  scene.time += dt;

  this.updateSystems(dt);

  view.step(dt);
};

/*
 * Get BodyModels from all the named SolidModels.
 */
Scene.prototype.getBodyModels = function () {
  var models = [];

  for (var modelName in this.models) {
    var solidModel = this.models[modelName];

    if (!solidModel) {
      continue;
    }

    for (var bodyModel of solidModel.models) {
      models.push(bodyModel);
    }
  }

  return models;
};

/*
 * Render everything. TODO rework this.
 */
Scene.prototype.draw = function (state) {
  var gl = state.gl;

  var bodyModels = this.getBodyModels();

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

    if (!nodes.length) {
      nodes = [model.sceneNode];
      // continue;
    }

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
    // if (!model.getInstances().length) {
    //  continue;
    // }

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

    var count = mesh.model.getInstances().length || 1;

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
