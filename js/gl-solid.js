'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');

// TODO
// Nomenclature change, maybe?
// A SOL contains a list of materials, models (bodies), entities, collision shapes.
// It's a self-contained world of objects, but each SOL is completely separate.
// Tempted to load the models, entities, etc, into a shared world instead. Pros, cons?
function GLSolid(gl, sol) {
  this.bodies = null;

  if (sol && gl) {
    this.loadBodies(sol);
    this.loadBodyMeshes(gl);
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


function BodyModel() {
  this.meshes = null;
  this.matrix = null;

  // TODO
  this.moverTranslate = null;
  this.moverRotate = null;

  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;
}

const OPAQUE = 'opaqueMeshes';
const OPAQUE_DECAL = 'opaqueDecalMeshes';
const TRANSPARENT_DECAL = 'transparentDecalMeshes';
const TRANSPARENT = 'transparentMeshes';
const REFLECTIVE = 'reflectiveMeshes';

BodyModel.prototype.sortMeshes = function() {
  var opaqueMeshes = [];
  var opaqueDecalMeshes = [];
  var transparentDecalMeshes = [];
  var transparentMeshes = [];
  var reflectiveMeshes = [];

  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (mtrl.isOpaque()) {
      opaqueMeshes.push(mesh);
    } else if (mtrl.isOpaqueDecal()) {
      opaqueDecalMeshes.push(mesh);
    } else if (mtrl.isTransparentDecal()) {
      transparentDecalMeshes.push(mesh);
    } else if (mtrl.isTransparent()) {
      transparentMeshes.push(mesh);
    } else if (mtrl.isReflective()) {
      reflectiveMeshes.push(mesh);
    }
  }

  this.opaqueMeshes = opaqueMeshes;
  this.opaqueDecalMeshes = opaqueDecalMeshes;
  this.transparentDecalMeshes = transparentDecalMeshes;
  this.transparentMeshes = transparentMeshes;
  this.reflectiveMeshes = reflectiveMeshes;
}

/*
 * Update mover state, recalculate transform on movement.
 */
BodyModel.prototype.step = function(dt) {
  // TODO not GL related
  var moverTranslate = this.moverTranslate;
  var moverRotate = this.moverRotate;

  moverTranslate.step(dt);
  moverRotate.step(dt);

  // Recalculate transform matrix on update.

  if (moverTranslate.update || moverRotate.update) {
    var p = vec3.create();
    var e = quat.create();

    moverTranslate.getPosition(p);
    moverRotate.getOrientation(e);

    mat4.fromRotationTranslation(this.matrix, e, p);
  }
}

BodyModel.prototype.getTransform = function() {
  return this.matrix;
}

/*
 * Load body meshes and initial transform from SOL.
 */
GLSolid.prototype.loadBodies = function(sol) {
  this.bodies = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var body = new BodyModel();

    body.meshes = sol.getBodyMeshes(solBody);
    body.matrix = sol.getBodyTransform(solBody);

    // TODO not GL related
    var movers = Mover.fromSolBody(sol, solBody);
    body.moverTranslate = movers[0];
    body.moverRotate = movers[1];

    body.sortMeshes();

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
GLSolid.prototype.loadBodyMeshes = function(gl) {
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
function drawMeshes(gl, state, meshes) {
  for (var i = 0; i < meshes.length; ++i) {
    meshes[i].draw(gl, state);
  }
}

GLSolid.prototype.drawMeshes = function(gl, state, meshType) {
  var bodies = this.bodies;

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];
    // TODO do the math on the CPU
    gl.uniformMatrix4fv(state.uModelID, false, body.getTransform());
    drawMeshes(gl, state, body[meshType]);
  }
}

GLSolid.prototype.drawBodies = function(gl, state) {
  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  // TODO
  this.drawMeshes(gl, state, REFLECTIVE);

  this.drawMeshes(gl, state, OPAQUE);
  this.drawMeshes(gl, state, OPAQUE_DECAL);

  // TODO?
  gl.depthMask(false);
  {
    this.drawMeshes(gl, state, TRANSPARENT_DECAL);
    this.drawMeshes(gl, state, TRANSPARENT);
  }
  gl.depthMask(true);

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = GLSolid;