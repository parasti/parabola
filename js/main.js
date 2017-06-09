'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('./util.js');
var SolReader = require('./solid.js').SolReader;
var GLState = require('./gl-state.js');

var state_wip = new GLState();

// TODO
var sol = null;
var bodies = [];
var mvpMatrix = mat4.create();

function loadBodies(gl) {
  bodies = [];
  for (var i = 0; i < sol.bc; ++i) {
    var bp = sol.bv[i];
    bodies.push(sol.getBodyMeshes(bp));
    // TODO
    bodies[i].bp = bp;
  }
  loadBodyMeshes(gl);
}

function loadBodyMeshes(gl) {
  for (var i = 0; i < bodies.length; ++i) {
    var meshes = bodies[i];

    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];
      mesh.createVBO(gl);
    }
  }

  loadTextures(gl);
}

function loadTextures(gl) {
  // Body.prototype.loadMeshMaterials?
  for (var i = 0; i < bodies.length; ++i) {
    var meshes = bodies[i];
    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];
      mesh.mtrl.loadTexture(gl);
    }
  }
}

function initGL(canvas) {
  var gl = canvas.getContext('webgl', {
    depth: true
  });

  state_wip.createDefaultTexture(gl);
  state_wip.createShaders(gl);
  state_wip.calcPerspective(canvas.width, canvas.height);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthFunc(gl.LEQUAL);

  // Fix upside down images.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  return gl;
}

function init() {
  var canvas = document.getElementById('canvas');
  var gl = initGL(canvas);

  function step(dt) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (state_wip.prog) {
      gl.useProgram(state_wip.prog);
      gl.uniform1i(state_wip.textureUniformLoc, 0);

      // TODO, don't do this here?
      if (sol) {
        mat4.multiply(mvpMatrix,
          state_wip.perspMatrix,
          sol.getView().getMatrix());
      }

      for (var i = 0; i < bodies.length; ++i) {
        // TODO
        var bp = bodies[i].bp;
        if (bp.pi >= 0) {
          var bodyTransform = sol.getBodyTransform(bp);
          var mvpFinal = mat4.create();
          mat4.multiply(mvpFinal, mvpMatrix, bodyTransform);
          gl.uniformMatrix4fv(state_wip.mvpUniformLoc, false, mvpFinal);
        } else {
          gl.uniformMatrix4fv(state_wip.mvpUniformLoc, false, mvpMatrix);
        }

        var meshes = bodies[i];
        for (var j = 0; j < meshes.length; ++j) {
          meshes[j].draw(gl, state_wip);
        }
      }

      gl.useProgram(null);
    }

    if (gl.getError() !== gl.NO_ERROR) {
      console.log('gl error');
    }

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    var reader = new SolReader();

    reader.onload = function() {
      // TODO multiple sols, items, goals, etc.
      sol = this.result;
      loadBodies(gl);
    };

    reader.read(this.files[0]);
  });
}

/*
 * Exports.
 */
module.exports = init;
