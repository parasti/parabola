'use strict';

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');
var SolReader = require('./solid.js').SolReader;
var GLState = require('./gl-state.js');
var View = require('./view.js');

function init() {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);

  var sol = null;
  var view_k = 1.0;
  var view = new View();

  function getDT(currTime) {
    var self = getDT;
    if (self.lastTime == null) {
      self.lastTime = 0.0;
    }
    var dt = (currTime - self.lastTime) / 1000.0;
    if (dt > 1.0) {
      dt = 0.0;
    }
    self.lastTime = currTime;
    return dt;
  }

  function step(currTime) {
    var dt = getDT(currTime);

    // TODO
    view.step(dt);

    mat4.copy(state.viewMatrix, view.getMatrix());
    state.draw(gl);

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  var viewPosition = document.getElementById('viewPosition');
  viewPosition.addEventListener('input', function() {
    if (sol) {
      view = sol.getView(this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    // Convenience over logic
    viewPosition.focus();
    viewPosition.value = 1;

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

  window.addEventListener('keydown', function(e) {
    var code = e.code; // Not very portable.

    if (code === 'KeyW') {
      view.moveForward(true);
    } else if (code === 'KeyA') {
      view.moveLeft(true);
    } else if (code === 'KeyS') {
      view.moveBackward(true);
    } else if (code === 'KeyD') {
      view.moveRight(true);
    }

  });

  window.addEventListener('keyup', function(e) {
    var code = e.code;

    if (code === 'KeyW') {
      view.moveForward(false);
    } else if (code === 'KeyA') {
      view.moveLeft(false);
    } else if (code === 'KeyS') {
      view.moveBackward(false);
    } else if (code === 'KeyD') {
      view.moveRight(false);
    }

  });
}

/*
 * Exports.
 */
module.exports = init;
