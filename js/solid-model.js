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

  loop: for (var i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];
    var ent;

    // TODO types[t] || continue;
    switch (solItem.t) {
      case 1: ent = new Entity('item_coin'); break;
      case 2: ent = new Entity('item_grow'); break;
      case 3: ent = new Entity('item_shrink'); break;
      default: continue loop; break;
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
 * Render model meshes of the given type. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawMeshType = function(gl, state, meshType, parentMatrix) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = ent.model;

    if (model) {
      if (parentMatrix) {
        var modelMatrix = mat4.create(); // TODO move this off the render path
        mat4.multiply(modelMatrix, parentMatrix, ent.getTransform());
        gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);
      } else {
        gl.uniformMatrix4fv(state.uModelID, false, ent.getTransform());
      }

      model.drawMeshType(gl, state, meshType);
    }
  }
}

/*
 * Render model meshes. Pass a parentMatrix for hierarchical transform.
 */
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

/*
 * Render item entities with a pre-loaded model.
 */
SolidModel.prototype.drawItems = function(gl, state) {
  var ents = this.ents;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    // TODO
    if (ent.type === 'item_coin') {
      // Pass entity transform as a parent matrix for nested SolidModel rendering.
      state.coinModel.drawBodies(gl, state, ent.getTransform());
    } else if (ent.type === 'item_grow') {
      state.growModel.drawBodies(gl, state, ent.getTransform());
    } else if (ent.type === 'item_shrink') {
      state.shrinkModel.drawBodies(gl, state, ent.getTransform());
    }
  }
}

module.exports = SolidModel;