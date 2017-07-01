'use strict';

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');

var misc = require('./misc.js');
var data = require('./data.js');

var Solid = require('./solid.js').Solid;
var GLState = require('./gl-state.js');
var View = require('./view.js');

var getDeltaTime = (function () {
  var lastTime = 0.0;

  return function(currTime) {
    var dt = (currTime - lastTime) / 1000.0;

    if (dt > 1.0) {
      dt = 0.0;
    }

    lastTime = currTime;
    return dt;
  }
})();

function init() {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);
  var sol = null;
  var view = new View();

  Solid.fetch('map-fwp/adventure.sol', function() {
    sol = this;

    state.loadLevel(gl, sol);
    view.setFromSol(sol, 1.0);
  });

  function step(currTime) {
    var dt = getDeltaTime(currTime);

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
      view.setFromSol(sol, this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    if (!this.files.length) {
      return;
    }

    data.loadFile(this.files[0], function(e) {
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
    view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  });

  var textureInput = document.getElementById('textures');
  textureInput.addEventListener('change', function(e) {
    state.enableTextures = this.checked;
  });

  var materialElem = document.getElementById('materials');
  var listMaterials = document.getElementById('listMaterials');
  listMaterials.addEventListener('click', function(e) {
    if (sol) {
      var html = '<select size="10">';
      for (var i = 0; i < sol.mv.length; ++i) {
        html += '<option>' + sol.mv[i].f + '</option>';
      }
      html += '</select>'
      materialElem.innerHTML = html;
    }
  });
}

/*
 * Exports.
 */
module.exports = init;
