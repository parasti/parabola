'use strict';

var screenfull = require('screenfull');
var data = require('./data.js');

var GLState = require('./gl-state.js');
var GLPool = require('./gl-pool.js');
var Scene = require('./scene.js');
var SolidModel = require('./solid-model.js');
var Mtrl = require('./mtrl.js');

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

function createGradientModel (pool, sol, gradFile) {
  // Insert a gradient material in-place.
  sol.mv[0].f = gradFile;

  // Cache it manually to keep our flag changes from being overwritten.
  var gradMtrl = Mtrl.fromSolMtrl(sol.mv[0]);
  gradMtrl.flags &= ~Mtrl._DEPTH_TEST;
  gradMtrl.flags &= ~Mtrl._DEPTH_WRITE;
  pool._cacheMtrl(gradMtrl);

  // Cache the rest of the resources.
  pool.cacheSol(sol);

  // Create a model.
  var model = SolidModel.fromSol(sol);

  // Scale it.
  model.sceneRoot.setLocalMatrix([0, 0, 0], [0, 0, 0, 1], [-256.0, 256.0, -256.0]); // BACK_DIST

  return model;
}

function init () {
  var canvas = document.getElementById('canvas');
  var state = GLState(canvas);
  var pool = GLPool();
  var scene = Scene();
  var gl = state.gl;
  var solFile = null;

  function createObjects (res) {
    res.createObjects(state);
  }

  pool.emitter.on('mtrl', createObjects);
  pool.emitter.on('model', createObjects);
  pool.emitter.on('shader', createObjects);

  data.fetchSolid('geom/back/back.sol').then(function (sol) {
    var model = createGradientModel(pool, sol, 'back/alien');
    // TODO 'level' serves as scene root, which it shouldn't.
    scene.setModel(state, 'level', model);
    return model;
  });

  var modelPaths = {
    background: 'map-back/alien.sol'
    // coin: 'item/coin/coin.sol',
    // coin5: 'item/coin/coin5.sol',
    // coin10: 'item/coin/coin10.sol',
    // grow: 'item/grow/grow.sol',
    // shrink: 'item/shrink/shrink.sol',
    // jump: 'geom/beam/beam.sol',
    // ballSolid: 'ball/basic-ball/basic-ball-solid.sol'
  };

  for (let modelName in modelPaths) {
    data.fetchSolid(modelPaths[modelName]).then(function (sol) {
      pool.cacheSol(sol);
      var model = SolidModel.fromSol(sol);
      scene.setModel(state, modelName, model);
      return model;
    });
  }

  // loadBall(gl, state, 'snowglobe');

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  scene.view.setProjection(gl.canvas.width, gl.canvas.height, 50);

  /*
   * Basic requestAnimationFrame loop.
   */
  function animationFrame (currTime) {
    window.requestAnimationFrame(animationFrame);

    var dt = getDeltaTime(currTime);

    if (dt < 1.0) {
      step(dt);
    }
  }
  window.requestAnimationFrame(animationFrame);

  /*
   * requestAnimationFrame-independent parts.
   */
  function step (dt) {
    // TODO handle canvas size changes
    scene.view.setProjection(gl.canvas.clientWidth, gl.canvas.clientHeight, 50);

    scene.view.mouseLook(0, 0);
    scene.step(dt);
    scene.draw(state);
  }

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

  var setViewPositionInput = document.getElementById('set-view-position');

  if (setViewPositionInput) {
    setViewPositionInput.addEventListener('input', function () {
      if (solFile) {
        scene.view.setFromSol(solFile, this.value);
      }
    });
  }

  var toggleFullscreenInput = document.getElementById('toggle-fullscreen');

  if (toggleFullscreenInput) {
    toggleFullscreenInput.addEventListener('change', function () {
      if (screenfull.enabled) {
        screenfull.toggle(document.getElementById('main'));
      }
    });
  }

  if (screenfull.enabled) {
    screenfull.on('change', function () {
      if (toggleFullscreenInput) {
        toggleFullscreenInput.checked = screenfull.isFullscreen;
      }
      if (screenfull.isFullscreen) {
        canvas.width = window.screen.width;
        canvas.height = window.screen.height;
      } else {
        canvas.width = 800;
        canvas.height = 600;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      scene.view.setProjection(canvas.width, canvas.height, 50);
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

  var toggleTexturesInput = document.getElementById('toggle-textures');

  if (toggleTexturesInput) {
    toggleTexturesInput.addEventListener('change', function (e) {
      state.enableTextures = this.checked;
    });
  }
}

init();
