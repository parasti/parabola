'use strict';

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');
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
      state.loadLevel(gl, sol);
    }

    reader.read(this.files[0]);
  });

  var fullscreen = document.getElementById('fullscreen');
  fullscreen.addEventListener('click', function() {
    if (screenfull.enabled) {
      screenfull.request(canvas);
    }
  });

  if (screenfull.enabled) {
    screenfull.onchange(function () {
      if (screenfull.isFullscreen) {
        canvas.width = window.screen.width;
        canvas.height = window.screen.height;
        viewPosition.focus();
      } else {
        canvas.width = 800;
        canvas.height = 600;
      }
      // TODO
      gl.viewport(0, 0, canvas.width, canvas.height);
      state.calcPerspective(canvas.width, canvas.height);
    });
  }
}

/*
 * Exports.
 */
module.exports = init;
