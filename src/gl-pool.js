'use strict';

var EventEmitter = require('events');

var Mtrl = require('./mtrl.js');
var Shader = require('./shader.js');
var BodyModel = require('./body-model.js');

module.exports = GLPool;

/**
 * Keep track of allocated GL resources.
 *
 * There are three types of resources:
 *
 * 1) materials (textures)
 * 2) shaders (programs)
 * 3) models (VBOs and VAOs)
 *
 * Cache a SOL's resources with pool.cacheSol(sol).
 *
 * pool.emitter is an EventEmitter that emits 'mtrl', 'shader', 'model'
 * events for each cached resource.
 */
function GLPool () {
  if (!(this instanceof GLPool)) {
    return new GLPool();
  }

  this.emitter = new EventEmitter();

  this.materials = makeCache(Object.create(null)); // Keyed by name (string).
  this.shaders = makeCache([]); // Keyed by flags (integer).
  this.models = makeCache(Object.create(null)); // Keyed by id (string).
}

function makeCache (store) {
  return {
    store: store,

    set: function (key, obj) {
      this.store[key] = obj;
    },

    get: function (key) {
      return this.store[key];
    }
  };
}

GLPool.prototype._getMtrl = function (name) {
  return this.materials.get(name);
};

GLPool.prototype._getShader = function (flags) {
  return this.shaders.get(flags);
};

GLPool.prototype._getModel = function (id) {
  return this.models.get(id);
};

/**
 *
 * @param {Mtrl} mtrl material
 */
GLPool.prototype._cacheMtrl = function (mtrl) {
  this.materials.set(mtrl.name, mtrl);
  this.emitter.emit('mtrl', mtrl);
};

GLPool.prototype._cacheShader = function (shader) {
  this.shaders.set(shader.flags, shader);
  this.emitter.emit('shader', shader);
};

GLPool.prototype._cacheModel = function (model) {
  this.models.set(model.id, model);
  this.emitter.emit('model', model);
};

/**
 * Cache materials and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheMtrlsFromSol = function (sol) {
  var pool = this;

  sol._materials = Array(sol.mtrls.length);

  for (var mi = 0; mi < sol.mtrls.length; ++mi) {
    var solMtrl = sol.mtrls[mi];
    var mtrl = pool._getMtrl(solMtrl.f);

    if (!mtrl) {
      mtrl = Mtrl.fromSolMtrl(sol, mi);
      pool._cacheMtrl(mtrl);
    }

    sol._materials[mi] = mtrl;
  }
};

/**
 * Cache models and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheModelsFromSol = function (sol) {
  var pool = this;

  sol._models = Array(sol.bodies.length);

  for (var bi = 0; bi < sol.bodies.length; ++bi) {
    var id = BodyModel.getIdFromSolBody(sol, bi);
    var model = pool._getModel(id);

    if (!model) {
      model = BodyModel.fromSolBody(sol, bi);
      pool._cacheModel(model);
    }

    sol._models[bi] = model;
  }

  // TODO
  sol._billboardModels = Array(sol.bills.length);

  for (var i = 0, n = sol.bills.length; i < n; ++i) {
    var id = BodyModel.getIdFromSolBill(sol, i);
    var model = pool._getModel(id);

    if (!model) {
      model = BodyModel.fromSolBill(sol, i);
      pool._cacheModel(model);
    }
    sol._billboardModels[i] = model;
  }
};

/**
 * Cache shaders and add a SOL-to-cache map to the SOL.
 */
GLPool.prototype.cacheShadersFromSol = function (sol) {
  var pool = this;

  sol._shaders = Array(sol.mtrls.length);

  for (var mi = 0; mi < sol.mtrls.length; ++mi) {
    var solMtrl = sol.mtrls[mi];
    var flags = Shader.getFlagsFromSolMtrl(solMtrl);
    var shader = pool._getShader(flags);

    if (!shader) {
      shader = Shader.fromSolMtrl(solMtrl);
      pool._cacheShader(shader);
    }

    sol._shaders[mi] = shader;
  }
};

/**
 * Cache resources from the SOL.
 */
GLPool.prototype.cacheSol = function (sol) {
  this.cacheShadersFromSol(sol);
  this.cacheMtrlsFromSol(sol);
  this.cacheModelsFromSol(sol);
};

GLPool.prototype.createObjects = function () {
  for (var mtrlId in this.materials.store) { // Object
    this.emitter.emit('mtrl', this.materials.get(mtrlId));
  }

  for (var shaderId in this.shaders.store) { // Sparse array
    this.emitter.emit('shader', this.shaders.get(shaderId));
  }

  for (var modelId in this.models.store) { // Object
    this.emitter.emit('model', this.models.get(modelId));
  }
}