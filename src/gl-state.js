'use strict';

var Shader = require('./shader.js');

module.exports = GLState;

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
  this.aModelViewMatrixID = 3;

  this.enabledArrays = [];
  this.usedProgram = null;
  this.boundBuffers = [];

  this.gl = getContext(canvas);
  setupContext(this.gl);
  this.createDefaultObjects();

  this.instancedArrays = this.gl.getExtension('ANGLE_instanced_arrays');
}

GLState.prototype.vertexAttribDivisor = function (index, divisor) {
  if (this.instancedArrays) {
    this.instancedArrays.vertexAttribDivisorANGLE(index, divisor);
  }
};

GLState.prototype.drawElementsInstanced = function (mode, count, type, offset, primcount) {
  if (this.instancedArrays) {
    this.instancedArrays.drawElementsInstancedANGLE(mode, count, type, offset, primcount);
  }
};

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
 * Track vertex attribute array enabled/disabled state.
 */
GLState.prototype.enableVertexAttribArray = function (index) {
  if (!this.enabledArrays[index]) {
    this.gl.enableVertexAttribArray(index);
    this.enabledArrays[index] = true;
  }
};

GLState.prototype.disableVertexAttribArray = function (index) {
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
  } else {
    console.log('reusing bound buffer');
  }
};
