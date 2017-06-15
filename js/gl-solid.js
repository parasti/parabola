'use strict';

var Mtrl = require('./mtrl.js');

function GLSolid() {
  this.bodies = null;
  // TODO what else?
}

function GLSolidBody() {
  this.meshes = null;
  this.matrix = null;

  // TODO
  this.opaqueMeshes = null;
  this.opaqueDecalMeshes = null;
  this.transparentDecalMeshes = null;
  this.transparentMeshes = null;
  this.reflectiveMeshes = null;
}

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

GLSolid.prototype.drawBodies = function(gl, state) {
  var bodies = this.bodies;

  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];

    // TODO do the math on the CPU
    gl.uniformMatrix4fv(state.uModelID, false, body.matrix);

    drawMeshes(gl, state, body.opaqueMeshes);
    drawMeshes(gl, state, body.opaqueDecalMeshes);

    gl.depthMask(false);
    {
      drawMeshes(gl, state, body.transparentDecalMeshes);
      drawMeshes(gl, state, body.transparentMeshes);
    }
    gl.depthMask(true);

    // TODO
    drawMeshes(gl, state, body.reflectiveMeshes);
  }

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = GLSolid;