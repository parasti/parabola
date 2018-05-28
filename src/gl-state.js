'use strict';

var mat4 = require('gl-matrix').mat4;

var SolidModel = require('./solid-model.js');
var View = require('./view.js');
var Shader = require('./shader.js');

/*
 * A few notes on webglcontextrestored handling:
 * 1) Context and GL objects/state need to be reacquired upon context-restore.
 * 2) The vertex attributes/texture data/shader code needs to be kept around.
 * 3) Each object rebuild should be async (in a Promise), to keep the thread from stalling.
 */

function GLState (canvas) {
  if (!(this instanceof GLState)) {
    return new GLState(canvas);
  }

  this.defaultTexture = null;
  this.enableTextures = true;

  this.defaultShader = null;

  this.aPositionID = 0;
  this.aNormalID = 1;
  this.aTexCoordID = 2;

  this.enabledArrays = [];
  this.usedProgram = null;
  this.boundBuffers = [];

  // TODO This is scene, not GL state

  this.projectionMatrix = mat4.create();
  this.viewMatrix = mat4.create();

  this.view = new View();

  this.gl = getContext(canvas);
  setupContext(this.gl);
  this.createDefaultObjects();
}

/*
 * Obtain a WebGL context. Now IE compatible, whoo.
 */
function getContext (canvas) {
  var opts = { depth: true, alpha: false };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  return gl;
}

/*
 * TODO? Some of this sets up material state, which could happen elsewhere.
 */
function setupContext (gl) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  // Straight alpha vs premultiplied alpha:
  // https://limnu.com/webgl-blending-youre-probably-wrong/
  // https://developer.nvidia.com/content/alpha-blending-pre-or-not-pre
  // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0, 0, 0, 1.0);

  // Fix upside down images.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
}

/*
 * TODO
 */
GLState.prototype.createDefaultObjects = function () {
  var gl = this.gl;

  this.createDefaultTexture(gl);

  this.defaultShader = Shader.origShader();
  this.defaultShader.createObjects(gl);

  this.calcPerspective(gl.canvas.width, gl.canvas.height);
};

/*
 * WebGL spams console when sampling an unbound texture, so we bind this.
 */
GLState.prototype.createDefaultTexture = function (gl) {
  if (this.defaultTexture) {
    console.warn('Attempted to remake default texture');
    return;
  }

  var data = [
    0xff, 0x00, 0xff, 0xff,
    0xff, 0xff, 0x00, 0xff,
    0x00, 0xff, 0xff, 0xff,
    0xff, 0x00, 0xff, 0xff
  ];

  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data));
  gl.bindTexture(gl.TEXTURE_2D, null);
  this.defaultTexture = tex;
};

/*
 * Compute a Neverball perspective matrix.
 */
GLState.prototype.calcPerspective = function (w, h) {
  var fov = 50 * Math.PI / 180; // TODO pass as a param?
  var a = w / h;

  // Neverball defaults.
  var n = 0.1;
  var f = 512.0;

  mat4.perspective(this.projectionMatrix, fov, a, n, f);
};

/*
 * Track vertex attribute array enabled/disabled state.
 */
GLState.prototype.enableArray = function (index) {
  if (!this.enabledArrays[index]) {
    this.gl.enableVertexAttribArray(index);
    this.enabledArrays[index] = true;
  }
};

GLState.prototype.disableArray = function (index) {
  if (this.enabledArrays[index]) {
    this.gl.disableVertexAttribArray(index);
    this.enabledArrays[index] = false;
  }
};

/*
 * Track used program.
 */
GLState.prototype.useProgram = function (program) {
  if (program !== this.usedProgram) {
    this.gl.useProgram(program);
    this.usedProgram = program;
  }
};

/*
 * Track bound buffers.
 */
GLState.prototype.bindBuffer = function (target, buffer) {
  if (buffer !== this.boundBuffers[target]) {
    this.gl.bindBuffer(target, buffer);
    this.boundBuffers[target] = buffer;
  }
}

module.exports = GLState;
