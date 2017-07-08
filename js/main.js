'use strict';

var mat4 = require('gl-matrix').mat4;
var screenfull = require('screenfull');

var misc = require('./misc.js');
var data = require('./data.js');

var Solid = require('./solid.js').Solid;
var GLState = require('./gl-state.js');
var View = require('./view.js');
var BallModel = require('./ball-model.js');

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

function loadBall(gl, state, name) {
  var name = name || 'basic-ball';

  var basePath = 'ball/' + name + '/' + name;

  BallModel.fetch(gl, basePath).then(function(model) {
    state.loadBall(gl, model);
  });
}

function init() {
  var canvas = document.getElementById('canvas');
  var gl = GLState.initGL(canvas);
  var state = new GLState(gl);
  var solFile = null;
  var view = new View();

  Solid.fetch('map-fwp/adventure.sol').then(function(sol) {
    solFile = sol;
    state.loadLevel(gl, sol);
    view.setFromSol(sol, 1.0);
  });

  Solid.fetch('item/coin/coin.sol').then(function(sol) {
    state.loadCoin(gl, sol);
  });
  Solid.fetch('item/coin/coin5.sol').then(function(sol) {
    state.loadCoin5(gl, sol);
  });
  Solid.fetch('item/coin/coin10.sol').then(function(sol) {
    state.loadCoin10(gl, sol);
  });
  Solid.fetch('item/grow/grow.sol').then(function(sol) {
    state.loadGrow(gl, sol);
  });
  Solid.fetch('item/shrink/shrink.sol').then(function(sol) {
    state.loadShrink(gl, sol);
  });

  loadBall(gl, state, 'snowglobe');

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

      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);


    } else {
      document.removeEventListener('mousemove', mouseMove);

      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
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
    if (solFile) {
      view.setFromSol(solFile, this.value);
    }
  });

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function() {
    if (!this.files.length) {
      return;
    }

    data.loadFile(this.files[0], function(e) {
      solFile = Solid.load(this.result);
      state.loadLevel(gl, solFile);
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

  function keyDown(e) {
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

  }
  function keyUp(e) {
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

  }

  canvas.addEventListener('wheel', function(e) {
    view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  });

  var textureInput = document.getElementById('textures');
  textureInput.addEventListener('change', function(e) {
    state.enableTextures = this.checked;
  });

  var ballNameElem = document.getElementById('ballName');
  var ballButton = document.getElementById('loadBall');
  ballButton.addEventListener('click', function(e) {
    loadBall(gl, state, ballName.value);
  });
}

/*
 * Exports.
 */
module.exports = init;
