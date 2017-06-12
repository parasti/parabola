'use strict';

function GLSolid() {
  this.bodies = null;
  // TODO what else?
}

/*
 * Load body meshes and initial transform from SOL.
 */
GLSolid.prototype.loadBodies = function(sol) {
  this.bodies = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    this.bodies.push({
      meshes: sol.getBodyMeshes(solBody),
      // TODO figure out how to update this w/o linking to SOL
      matrix: sol.getBodyTransform(solBody)
    });
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

    var meshes = body.meshes;
    for (var j = 0; j < meshes.length; ++j) {
      meshes[j].draw(gl, state);
    }
  }


  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = GLSolid;