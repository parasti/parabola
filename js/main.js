'use strict';

var mat4 = require('gl-matrix').mat4;
var SolReader = require('./solid.js').SolReader;
var GLState = require('./gl-state.js');

function init() {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);

  var sol = null;
  var view_k = 1.0;

  function step(dt) {
    if (sol) {
      var view = sol.getView(view_k);
      mat4.copy(state.viewMatrix, view.getMatrix());
    }

    state.draw(gl);
    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  var viewPosition = document.getElementById('viewPosition');
  viewPosition.addEventListener('input', function() {
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
      state.loadBodies(sol);
      state.loadBodyMeshes(gl);
    }

    reader.read(this.files[0]);
  });
}

/*
 * Exports.
 */
module.exports = init;
