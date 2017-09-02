'use strict';

document.addEventListener('DOMContentLoaded', function () {
  init();
});

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');
var data = require('./data.js');

var Solid = require('./solid.js');
var GLState = require('./gl-state.js');
var BallModel = require('./ball-model.js');

var getDeltaTime = (function () {
  var lastTime = 0.0;

  return function (currTime) {
    var dt = (currTime - lastTime) / 1000.0;

    if (dt > 1.0) {
      dt = 0.0;
    }

    lastTime = currTime;
    return dt;
  };
})();

function loadBall (gl, state, name = 'basic-ball') {
  var basePath = 'ball/' + name + '/' + name;

  BallModel.fetch(basePath).then(function (model) {
    state.setModel(gl, 'ball', model);
  });
}

function init () {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);
  var solFile = null;

  data.fetchSolid('map-easy/easy.sol').then(function (sol) {
    solFile = sol;
    state.setModelFromSol(gl, 'level', sol);
    state.view.setFromSol(sol, 1.0);
  });

  var modelPaths = {
    coin: 'item/coin/coin.sol',
    coin5: 'item/coin/coin5.sol',
    coin10: 'item/coin/coin10.sol',
    grow: 'item/grow/grow.sol',
    shrink: 'item/shrink/shrink.sol'
  };

  for (let modelName in modelPaths) {
    data.fetchSolid(modelPaths[modelName]).then(function (sol) {
      state.setModelFromSol(gl, modelName, sol);
    });
  }

  loadBall(gl, state, 'snowglobe');

  function step (currTime) {
    var dt = getDeltaTime(currTime);

    // TODO
    state.view.mouseLook(0, 0); // lerp until stop
    state.view.step(dt);

    state.step(dt);

    // TODO Move view to state?
    mat4.copy(state.viewMatrix, state.view.getMatrix());
    state.draw(gl);

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  function mouseMove (e) {
    state.view.mouseLook(e.movementX, e.movementY);
  }

  function pointerLockChange (e) {
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', mouseMove);

      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
    } else {
      document.removeEventListener('mousemove', mouseMove);

      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    }
  }

  function togglePointerLock (e) {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      canvas.requestPointerLock();
    }
  }

  canvas.addEventListener('click', togglePointerLock);
  document.addEventListener('pointerlockchange', pointerLockChange);

  var viewPosition = document.getElementById('viewPosition');
  viewPosition.addEventListener('input', function () {
    if (solFile) {
      state.view.setFromSol(solFile, this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function () {
    if (!this.files.length) {
      return;
    }

    data.loadFile(this.files[0]).then(function (arrayBuffer) {
      solFile = Solid.load(arrayBuffer);
      state.setModelFromSol(gl, 'level', solFile);
    });
  });

  var fullscreen = document.getElementById('fullscreen');
  fullscreen.addEventListener('click', function () {
    if (screenfull.enabled) {
      screenfull.request(canvas);
    }
  });

  if (screenfull.enabled) {
    screenfull.onchange(function () {
      if (screenfull.isFullscreen) {
        canvas.width = window.screen.width;
        canvas.height = window.screen.height;
        canvas.style.background = 'black';
      } else {
        canvas.width = 800;
        canvas.height = 600;
        canvas.style.background = 'inherit';
      }
      // TODO
      gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      state.calcPerspective(canvas.clientWidth, canvas.clientHeight);
    });
  }

  function keyDown (e) {
    var code = e.code; // Not very portable.

    if (code === 'KeyW') {
      state.view.moveForward(true);
    } else if (code === 'KeyA') {
      state.view.moveLeft(true);
    } else if (code === 'KeyS') {
      state.view.moveBackward(true);
    } else if (code === 'KeyD') {
      state.view.moveRight(true);
    }
  }
  function keyUp (e) {
    var code = e.code;

    if (code === 'KeyW') {
      state.view.moveForward(false);
    } else if (code === 'KeyA') {
      state.view.moveLeft(false);
    } else if (code === 'KeyS') {
      state.view.moveBackward(false);
    } else if (code === 'KeyD') {
      state.view.moveRight(false);
    }
  }

  canvas.addEventListener('wheel', function (e) {
    state.view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  });

  var textureInput = document.getElementById('textures');
  textureInput.addEventListener('change', function (e) {
    state.enableTextures = this.checked;
  });

  var ballNameElem = document.getElementById('ballName');
  var ballButton = document.getElementById('loadBall');
  ballButton.addEventListener('click', function (e) {
    loadBall(gl, state, ballNameElem.value);
  });
}
