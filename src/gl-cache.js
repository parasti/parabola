'use strict';

var Mtrl = require('./mtrl.js');

module.exports = GLCache;

function GLCache () {
  if (!(this instanceof GLCache)) {
    return new GLCache();
  }

  this.materials = makeCache({});
  this.shaders = makeCache([]);
  this.models = makeCache([]);
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

GLCache.prototype.cacheMtrl = function (mtrl) {
  this.materials.set(mtrl.name, mtrl);
}

GLCache.prototype.cacheShader = function (shader) {
  this.shaders.set(shader.flags, shader);
}

GLCache.prototype.cacheModel = function (model) {
  this.models.set(model.id, model);
}

GLCache.prototype.getMtrl = function (name) {
  this.materials.get(name);
}

GLCache.prototype.getShader = function (flags) {
  this.shaders.get(flags);
}

GLCache.prototype.getModel = function (id) {
  this.models.get(id);
}
