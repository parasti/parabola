'use strict';

var glMatrix = require('gl-matrix');
var mat4 = glMatrix.mat4;

var util = require('./util.js');
var solid = require('./solid.js');

var SolReader = solid.SolReader;

/*
 * Yup.
 */
var state = {};

state.prog = null;

state.textureUniformLoc = null;
state.mvpUniformLoc = null;
state.positionAttrLoc = 0;
state.normalAttrLoc = 1;
state.texCoordAttrLoc = 2;

var textureUniform = 'uTexture'; // FIXME. We're not even using this.
var mvpUniform = 'uMvp';
var positionAttr = 'aPosition';
var normalAttr = 'aNormal';
var texCoordAttr = 'aTexCoord';

var vertShader = `
uniform mat4 uMvp;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}
`;

var fragShader = `
precision highp float;

uniform sampler2D uTexture;
varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord);
}
`;

state.bodyMeshes = [];

state.mvpMatrix = mat4.create();

function loadBodyMeshes(gl) {
  var bodyMeshes = state.bodyMeshes;

  for (var bi = 0; bi < bodyMeshes.length; ++bi) {
    var meshes = bodyMeshes[bi];

    for (var mi = 0; mi < meshes.length; ++mi) {
      var mesh = meshes[mi];
      mesh.createVBO(gl);
    }
  }

  loadTextures(gl);
}

function loadTextures(gl) {
  // Body.prototype.loadMeshMaterials?
  var bodyMeshes = state.bodyMeshes;

  for (var i = 0; i < bodyMeshes.length; ++i) {
    var meshes = bodyMeshes[i];

    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];

      mesh.mtrl.loadTexture(gl);
    }
  }
}

function loadShader(gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

util.calcPersp = function () {
  var a = 800.0 / 600.0;
  var fov = 50;
  var n = 0.1;
  var f = 512.0;
  var M = mat4.create();

  var r = fov / 2 * Math.PI / 180;
  var s = Math.sin(r);
  var c = Math.cos(r) / s;

  M[0] = c / a;
  M[1] = 0;
  M[2] = 0;
  M[3] = 0;
  M[4] = 0;
  M[5] = c;
  M[6] = 0;
  M[7] = 0;
  M[8] = 0;
  M[9] = 0;
  M[10] = -(f + n) / (f - n);
  M[11] = -1.0;
  M[12] = 0;
  M[13] = 0;
  M[14] = -2.0 * n * f / (f - n);
  M[15] = 0;

  return M;
};

function makeDefaultTexture(gl) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([0xff, 0x00, 0xff, 0xff]));
  return tex;
}

function initGL(canvas) {
  var gl = canvas.getContext('webgl', {depth: true});

  // WebGL spams console if you sample an unbound texture.
  state.defaultTexture = makeDefaultTexture(gl);

  var vs = loadShader(gl, gl.VERTEX_SHADER, vertShader);
  var fs = loadShader(gl, gl.FRAGMENT_SHADER, fragShader);

  state.prog = gl.createProgram();

  gl.attachShader(state.prog, vs);
  gl.attachShader(state.prog, fs);

  gl.bindAttribLocation(state.prog, state.positionAttrLoc, positionAttr);
  gl.bindAttribLocation(state.prog, state.normalAttrLoc, normalAttr);
  gl.bindAttribLocation(state.prog, state.texCoordAttrLoc, texCoordAttr);

  gl.linkProgram(state.prog);

  if (!gl.getProgramParameter(state.prog, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(state.prog));
  }

  state.mvpUniformLoc = gl.getUniformLocation(state.prog, mvpUniform);
  state.textureUniformLoc = gl.getUniformLocation(state.prog, textureUniform);

  state.mvpMatrix = util.calcPersp();

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthFunc(gl.LEQUAL);

  // Such magic.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  return gl;
}

function init() {
  var gl = initGL(document.getElementById('canvas'));

  function step(dt) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (state.prog) {
      gl.useProgram(state.prog);

      gl.uniformMatrix4fv(state.mvpUniformLoc, false, state.mvpMatrix);
      gl.uniform1i(state.textureUniformLoc, 0);

      var bodyMeshes = state.bodyMeshes;
      for (var i = 0; i < bodyMeshes.length; ++i) {
        var meshes = bodyMeshes[i];

        for (var j = 0; j < meshes.length; ++j) {
          meshes[j].draw(gl, state);
        }
      }

      gl.useProgram(null);
    }

    if (gl.getError() !== gl.NO_ERROR) {
      console.log('gl error');
    }

    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function () {
    var reader = new SolReader();

    reader.onload = function () {
      var sol = this.result;

      // TODO, don't do this here.
      state.bodyMeshes = [];
      for (var i = 0; i < sol.bc; ++i) {
        if (sol.bv[i].pi < 0)
          state.bodyMeshes.push(sol.getBodyMeshes(sol.bv[i]));
      }
      loadBodyMeshes(gl);

      // TODO, don't do this here.
      mat4.multiply(state.mvpMatrix, util.calcPersp(), sol.getView().getModelView());
    };

    reader.read(this.files[0]);
  });
}

/*
 * Exports.
 */
module.exports = init;