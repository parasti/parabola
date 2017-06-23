'use strict';

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');
var Solid = require('./solid.js').Solid;
var SolReader = require('./solid.js').SolReader;
var GLState = require('./gl-state.js');
var View = require('./view.js');

function fetchDataFile(path, onload) {
  var req = new XMLHttpRequest();
  req.responseType = 'arraybuffer';
  req.addEventListener('load', function(e) {
    if (this.status === 200)
      onload.call(this, e);
  });
  req.open('GET', 'data/' + path);
  req.send();
}

function loadFile(file, onload) {
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    onload.call(this, e);
  });
  reader.readAsArrayBuffer(file);
}

function init() {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);
  var sol = null;
  var view = new View();

/*
  loadDataFile('map-fwp/adventure.sol', function(e) {
    sol = Solid.load(this.response);
    state.loadLevel(gl, sol);
    view = sol.getView(1.0);
  });
*/

  fetchDataFile('ball/snowglobe/snowglobe-inner.sol', function(e) {
    sol = Solid.load(this.response);
    state.loadLevel(gl, sol);
    view = new View([0, 0, 2], [0, -0.15, 0]);
  });

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
    view.mouseLook(0, 0); // lerp until stop
    view.step(dt);

    state.step(dt);

    mat4.copy(state.viewMatrix, view.getMatrix());
    state.draw(gl);

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  function mouseMove(e) {
    view.mouseLook(e.movementX, e.movementY);
  }

  function pointerLockChange(e) {
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', mouseMove);
    } else {
      document.removeEventListener('mousemove', mouseMove);
    }
  }

  function togglePointerLock(e) {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      canvas.requestPointerLock();
    }    
  }

  canvas.addEventListener('click', togglePointerLock);
  document.addEventListener('pointerlockchange', pointerLockChange);

  var viewPosition = document.getElementById('viewPosition');
  viewPosition.addEventListener('input', function() {
    if (sol) {
      view = sol.getView(this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    if (!this.files.length) {
      return;
    }

    loadFile(this.files[0], function(e) {
      sol = Solid.load(this.result);
      state.loadLevel(gl, sol);
    });
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
      } else {
        canvas.width = 800;
        canvas.height = 600;
      }
      // TODO
      gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      state.calcPerspective(canvas.clientWidth, canvas.clientHeight);
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

  window.addEventListener('wheel', function(e) {
    view.moveSpeed(-Math.sign(e.deltaY));
  })
}

/*
 * Exports.
 */
module.exports = init;
