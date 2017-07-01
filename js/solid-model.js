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
    var ent;

    if (solItem.t === 1) { // TODO
      ent = new Entity('item_coin');
    } else {
      continue;
    }

    ent.value = solItem.n; // TODO

    // TODO hieararchial transform
    ent.modelMatrix = mat4.create();

    const r = 0.15;
    const x = solItem.p[0];
    const y = solItem.p[1];
    const z = solItem.p[2];
    mat4.set(ent.modelMatrix,
      r, 0, 0, 0,
      0, r, 0, 0,
      0, 0, r, 0,
      x, y, z, 1);

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
SolidModel.prototype.drawMeshType = function(gl, state, meshType, parentMatrix) {
  var ents = this.ents;

  // TODO
  var modelMatrix;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = ent.model;

    if (model) {
      // todo multiply with parent transform
      if (parentMatrix) {
        modelMatrix = mat4.create();
        mat4.multiply(modelMatrix, parentMatrix, ent.getTransform());
      } else {
        modelMatrix = ent.getTransform();
      }

      gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);

      model.drawMeshType(gl, state, meshType);
    }
  }
}

SolidModel.prototype.drawBodies = function(gl, state, parentMatrix) {
  // TODO
  this.drawMeshType(gl, state, 'reflective', parentMatrix);

  this.drawMeshType(gl, state, 'opaque', parentMatrix);
  this.drawMeshType(gl, state, 'opaqueDecal', parentMatrix);

  // TODO?
  gl.depthMask(false);
  {
    this.drawMeshType(gl, state, 'transparentDecal', parentMatrix);
    this.drawMeshType(gl, state, 'transparent', parentMatrix);
  }
  gl.depthMask(true);
}

SolidModel.prototype.drawItems = function(gl, state) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    if (ent.type === 'item_coin') {
      // TODO hierarchial transform
      state.itemModel.drawBodies(gl, state, ent.getTransform());
    }
  }
}

module.exports = SolidModel;