'use strict';

var Mtrl = require('./mtrl.js');
var Shader = require('./shader.js');
var BodyModel = require('./body-model.js');

module.exports = GLPool;

function GLPool () {
  if (!(this instanceof GLPool)) {
    return new GLPool();
  }

  this.materials = makeCache({});
  this.shaders = makeCache([]);
  this.models = makeCache({});
}

function makeCache (pool) {
  return {
    _pool: pool,

    set: function (key, obj) {
      this._pool[key] = obj;
    },

    get: function (key) {
      return this._pool[key];
    }
  }
}

GLPool.prototype.getMtrl = function (name) {
  return this.materials.get(name);
}

GLPool.prototype.getShader = function (flags) {
  return this.shaders.get(flags);
}

GLPool.prototype.getModel = function (id) {
  return this.models.get(id);
}

GLPool.prototype.cacheMtrl = function (mtrl) {
  this.materials.set(mtrl.name, mtrl);
}

GLPool.prototype.cacheShader = function (shader) {
  this.shaders.set(shader.flags, shader);
}

GLPool.prototype.cacheModel = function (model) {
  this.models.set(model.id, model);
}