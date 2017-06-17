'use strict';

var Mtrl = require('./mtrl.js');

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

function GLSolidBody() {
  this.meshes = null;
  this.matrix = null;

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

GLSolidBody.prototype.sortMeshes = function() {
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
 * Load body meshes and initial transform from SOL.
 */
GLSolid.prototype.loadBodies = function(sol) {
  this.bodies = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var body = new GLSolidBody();

    body.meshes = sol.getBodyMeshes(solBody);
    body.matrix = sol.getBodyTransform(solBody);

    body.sortMeshes();

    this.bodies.push(body);
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
    gl.uniformMatrix4fv(state.uModelID, false, body.matrix);
    drawMeshes(gl, state, body[meshType]);
  }
}

GLSolid.prototype.drawBodies = function(gl, state) {
  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  this.drawMeshes(gl, state, OPAQUE);
  this.drawMeshes(gl, state, OPAQUE_DECAL);

  // TODO?
  gl.depthMask(false);
  {
    this.drawMeshes(gl, state, TRANSPARENT_DECAL);
    this.drawMeshes(gl, state, TRANSPARENT);
  }
  gl.depthMask(true);

  this.drawMeshes(gl, state, REFLECTIVE);

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = GLSolid;