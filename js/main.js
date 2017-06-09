'use strict';

var mat4 = require('gl-matrix').mat4;
var SolReader = require('./solid.js').SolReader;
var GLState = require('./gl-state.js');

var state = new GLState();

// TODO
var sol = null;
var bodies = [];

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
      // FIXME this attempts to load anew for every body
      mesh.mtrl.loadTexture(gl);
    }
  }
}

function initGL(canvas) {
  var opts = {
    depth: true
  };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);

  state.createDefaultTexture(gl);
  state.createShaders(gl);
  state.calcPerspective(canvas.width, canvas.height);

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


  var view_k = 1.0;

  function step(dt) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (state.prog) {
      gl.useProgram(state.prog);

      gl.uniform1i(state.uTextureID, 0);
      gl.uniformMatrix4fv(state.uPerspID, false, state.perspMatrix);

      // TODO
      if (sol) {
        gl.uniformMatrix4fv(state.uViewID, false, sol.getView(view_k).getMatrix());
      }

      for (var i = 0; i < bodies.length; ++i) {
        // TODO
        gl.uniformMatrix4fv(state.uModelID, false, sol.getBodyTransform(bodies[i].bp));

        var meshes = bodies[i];
        for (var j = 0; j < meshes.length; ++j) {
          meshes[j].draw(gl, state);
        }
      }

      gl.useProgram(null);
    }

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  var viewPosition = document.getElementById('viewPosition');
  viewPosition.addEventListener('input', function () {
    view_k = this.value;
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    // Convenience over logic
    viewPosition.focus();
    viewPosition.value = 1;
    view_k = 1.0;

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
