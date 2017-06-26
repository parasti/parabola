'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');

// TODO
// Nomenclature change, maybe?
// A SOL contains a list of materials, models (bodies), entities, collision shapes.
// It's a self-contained world of objects, but each SOL is completely separate.
// Tempted to load the models, entities, etc, into a shared world instead. Pros, cons?
function GLSolid(gl, sol) {
  this.bodies = null;

  if (sol && gl) {
    this.loadBodies(sol);
    this.createBodyMeshes(gl);
  }
}

// TODO
// drawEntities()
// something something
function Entity() {
  this.moverTranslate = null;
  this.moverRotate = null;
  // this.modelID = model identified as "body #m of SOL #n"
  // this.modelID = "SOL #n"? nested SolidModel for items, etc. complicated.
  //     model = new CoinModel(); model.draw(); let the model hide the SOL(s) inside.
  // this.modelID = model loaded from OBJ
  // etc
}
// drawEntities(entityList) {
//   for (ent)
//     model = getModel(ent.modelID)
//     matrix = ent.matrix
//     set uniforms
//     model.draw()
// }

/*
 * Load body meshes and initial transform from SOL.
 */
GLSolid.prototype.loadBodies = function(sol) {
  this.bodies = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var body = BodyModel.fromSolBody(sol, sol.bv[i]);
    this.bodies.push(body);
  }
}

// TODO not GL related
GLSolid.prototype.step = function(dt) {
  for (var i = 0; i < this.bodies.length; ++i) {
    this.bodies[i].step(dt);
  }
}

/*
 * Create body mesh VBOs and textures.
 */
// FIXME s/load/create/
GLSolid.prototype.createBodyMeshes = function(gl) {
  for (var i = 0; i < this.bodies.length; ++i) {
    var meshes = this.bodies[i].meshes;

    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];
      mesh.createVBO(gl);
      // TODO Keep a shared material cache instead of per-SOL?
      mesh.mtrl.loadTexture(gl);
    }
  }
}

/*
 * Render body meshes.
 */

GLSolid.prototype.drawMeshType = function(gl, state, meshType) {
  var bodies = this.bodies;

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];
    body.drawMeshType(gl, state, meshType);
  }
}

GLSolid.prototype.drawBodies = function(gl, state) {
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

module.exports = GLSolid;