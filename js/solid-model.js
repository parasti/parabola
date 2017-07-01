'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');
var Entity = require('./entity.js');

function SolidModel(gl, sol) {
  this.ents = null;

  if (sol && gl) {
    this.fromSol(sol);
    this.createObjects(gl);
  }
}

/*
 * Load body meshes and initial transform from SOL.
 */
SolidModel.prototype.fromSol = function(sol) {
  var ents = this.ents = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var ent = new Entity('body');

    // Graphical
    ent.model = BodyModel.fromSolBody(sol, solBody);

    // Spatial
    ent.movers = Mover.fromSolBody(sol, solBody);
    ent.modelMatrix = mat4.create();
    
    ents.push(ent);
  }

  for (var i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];

    if (solItem.t !== 1) { // TODO
      continue;
    }

    var ent = new Entity('item');

    ent.value = solItem.n; // TODO
    // TODO hieararchial transform
    ent.modelMatrix = mat4.create();
    mat4.fromTranslation(ent.modelMatrix, solItem.p);

    ents.push(ent);
  }
}

SolidModel.prototype.step = function(dt) {
  // TODO keep a list of entities that need this?
  for (var i = 0; i < this.ents.length; ++i) {
    this.ents[i].step(dt);
  }
}

/*
 * Create body mesh VBOs and textures.
 */
SolidModel.prototype.createObjects = function(gl) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    // TODO keep a list of entities with models
    var model = ents[i].model;
    if (model) {
      model.createObjects(gl);
    }
  }
}

/*
 * Render body meshes.
 */
SolidModel.prototype.drawMeshType = function(gl, state, meshType) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = ent.model;

    if (model) {
      gl.uniformMatrix4fv(state.uModelID, false, ent.getTransform());
      model.drawMeshType(gl, state, meshType);
    }
  }
}

SolidModel.prototype.drawBodies = function(gl, state) {
  // TODO
  this.drawMeshType(gl, state, 'reflective');

  this.drawMeshType(gl, state, 'opaque');
  this.drawMeshType(gl, state, 'opaqueDecal');

  // TODO?
  gl.depthMask(false);
  {
    this.drawMeshType(gl, state, 'transparentDecal');
    this.drawMeshType(gl, state, 'transparent');
  }
  gl.depthMask(true);
}

SolidModel.prototype.drawItems = function(gl, state) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    if (ents[i].type === 'item') {
      // TODO hierarchial transform
      state.itemModel.drawBodies(gl, state);
    }
  }
}

module.exports = SolidModel;