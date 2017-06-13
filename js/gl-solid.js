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

var opaqueRules = { in: 0, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT | Mtrl.DECAL };
var opaqueDecalRules = { in: Mtrl.DECAL, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT };
var transparentDecalRules = { in: Mtrl.DECAL | Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE };
var transparentRules = { in: Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE | Mtrl.DECAL };
var reflectiveRules = { in: Mtrl.REFLECTIVE, ex: 0 };

function testMtrl(mtrl, rules) {
  return ((mtrl.fl & rules.in) === rules.in && (mtrl.fl & rules.ex) === 0);
}

GLSolidBody.prototype.sortMeshes = function() {
  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (testMtrl(mtrl, opaqueRules)) {
      this.opaqueMeshes = this.opaqueMeshes || [];
      this.opaqueMeshes.push(mesh);
    } else if (testMtrl(mtrl, opaqueDecalRules)) {
      this.opaqueDecalMeshes = this.opaqueDecalMeshes || [];
      this.opaqueDecalMeshes.push(mesh);
    } else if (testMtrl(mtrl, transparentDecalRules)) {
      this.transparentDecalMeshes = this.transparentDecalMeshes || [];
      this.transparentDecalMeshes.push(mesh);
    } else if (testMtrl(mtrl, transparentRules)) {
      this.transparentMeshes = this.transparentMeshes || [];
      this.transparentMeshes.push(mesh);
    } else if (testMtrl(mtrl, reflectiveRules)) {
      this.reflectiveMeshes = this.reflectiveMeshes || [];
      this.reflectiveMeshes.push(mesh);
    }
  }
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
GLSolid.prototype.drawBodies = function(gl, state) {
  var bodies = this.bodies;

  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];

    // TODO do the math on the CPU
    gl.uniformMatrix4fv(state.uModelID, false, body.matrix);

    // TODO sort

    if (body.opaqueMeshes) {
      var meshes = body.opaqueMeshes;
      for (var j = 0; j < meshes.length; ++j) {
        meshes[j].draw(gl, state);
      }
    }

    if (body.opaqueDecalMeshes) {
      var meshes = body.opaqueDecalMeshes;
      for (var j = 0; j < meshes.length; ++j) {
        meshes[j].draw(gl, state);
      }
    }

    gl.depthMask(false);
    {
      if (body.transparentDecalMeshes) {
        var meshes = body.transparentDecalMeshes;
        for (var j = 0; j < meshes.length; ++j) {
          meshes[j].draw(gl, state);
        }
      }
      if (body.transparentMeshes) {
        var meshes = body.transparentMeshes;
        for (var j = 0; j < meshes.length; ++j) {
          meshes[j].draw(gl, state);
        }
      }
    }
    gl.depthMask(true);

    // TODO
    if (body.reflectiveMeshes) {
      var meshes = body.reflectiveMeshes;
      for (var j = 0; j < meshes.length; ++j) {
        meshes[j].draw(gl, state);
      }
    }
  }

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = GLSolid;