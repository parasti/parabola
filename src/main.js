'use strict';

document.addEventListener('DOMContentLoaded', function () {
  init();
});

var screenfull = require('screenfull');
var data = require('./data.js');

var GLState = require('./gl-state.js');
var Scene = require('./scene.js');
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
    // state.setModel(gl, 'ball', model);
  });
}

function init () {
  var canvas = document.getElementById('canvas');
  var state = GLState(canvas);
  var scene = Scene();
  var gl = state.gl;
  var solFile = null;

  state._scene = scene; // TODO UNHACK

  scene.view.setProjection(gl.canvas.width, gl.canvas.height, 50);

  data.fetchSolid('map-fwp/adventure.sol').then(function (sol) {
    solFile = sol;
    scene.setModel(state, 'level', sol);
    scene.view.setFromSol(sol, 1.0);
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
      scene.setModel(state, modelName, sol);
    });
  }

  loadBall(gl, state, 'snowglobe');

  function step (currTime) {
    var dt = getDeltaTime(currTime);

    scene.view.mouseLook(0, 0);
    scene.step(dt);
    scene.draw(state);

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  function mouseMove (e) {
    scene.view.mouseLook(e.movementX, e.movementY);
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
      scene.view.setFromSol(solFile, this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function () {
    if (!this.files.length) {
      return;
    }

    data.loadSolid(this.files[0]).then(function (sol) {
      solFile = sol;
      scene.setModel(state, 'level', solFile);
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
      } else {
        canvas.width = 800;
        canvas.height = 600;
      }
      // TODO
      gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      scene.view.setProjection(canvas.clientWidth, canvas.clientHeight, 50);
    });
  }

  function keyDown (e) {
    var code = e.code; // Not very portable.

    if (code === 'KeyW') {
      scene.view.moveForward(true);
    } else if (code === 'KeyA') {
      scene.view.moveLeft(true);
    } else if (code === 'KeyS') {
      scene.view.moveBackward(true);
    } else if (code === 'KeyD') {
      scene.view.moveRight(true);
    }
  }
  function keyUp (e) {
    var code = e.code;

    if (code === 'KeyW') {
      scene.view.moveForward(false);
    } else if (code === 'KeyA') {
      scene.view.moveLeft(false);
    } else if (code === 'KeyS') {
      scene.view.moveBackward(false);
    } else if (code === 'KeyD') {
      scene.view.moveRight(false);
    }
  }

  canvas.addEventListener('wheel', function (e) {
    scene.view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  }, { passive: false });

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
