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
    var ent = new Entity();

    // Graphical
    ent.model = BodyModel.fromSolBody(sol, solBody);

    // Spatial
    ent.movers = Mover.fromSolBody(sol, solBody);
    ent.modelMatrix = mat4.create();
    
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
    gl.uniformMatrix4fv(state.uModelID, false, ent.getTransform());
    model.drawMeshType(gl, state, meshType);
  }
}

SolidModel.prototype.drawBodies = function(gl, state) {
  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

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

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = SolidModel;