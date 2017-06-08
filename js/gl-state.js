'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('./util.js');

function GLState() {
  this.defaultTexture = null;

  this.prog = null;
  this.textureUniformLoc = null;
  this.mvpUniformLoc = null;
  this.positionAttrLoc = 0;
  this.normalAttrLoc = 1;
  this.texCoordAttrLoc = 2;

  this.perspMatrix = mat4.create();
}

GLState.textureUniform = 'uTexture';
GLState.mvpUniform = 'uMvp';
GLState.positionAttr = 'aPosition';
GLState.normalAttr = 'aNormal';
GLState.texCoordAttr = 'aTexCoord';

GLState.vertShader = `
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

GLState.fragShader = `
precision highp float;

uniform sampler2D uTexture;
varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord);
}
`;

GLState.loadShader = function(gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}


/*
 * WebGL spams console if you sample an unbound texture.
 */
GLState.prototype.createDefaultTexture = function(gl) {
  if (this.defaultTexture) {
    console.log('Attempted to remake default texture');
    return;
  }
  
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0xff, 0x00, 0xff, 0xff]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  this.defaultTexture = tex;
}

GLState.prototype.createShaders = function(gl) {
  var vs = GLState.loadShader(gl, gl.VERTEX_SHADER, GLState.vertShader);
  var fs = GLState.loadShader(gl, gl.FRAGMENT_SHADER, GLState.fragShader);

  this.prog = gl.createProgram();

  gl.attachShader(this.prog, vs);
  gl.attachShader(this.prog, fs);

  gl.bindAttribLocation(this.prog, this.positionAttrLoc, GLState.positionAttr);
  gl.bindAttribLocation(this.prog, this.normalAttrLoc, GLState.normalAttr);
  gl.bindAttribLocation(this.prog, this.texCoordAttrLoc, GLState.texCoordAttr);

  gl.linkProgram(this.prog);

  if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(this.prog));
  }

  this.mvpUniformLoc = gl.getUniformLocation(this.prog, GLState.mvpUniform);
  this.textureUniformLoc = gl.getUniformLocation(this.prog, GLState.textureUniform);
}

GLState.prototype.calcPersp = function(w, h) {
  util.calcPersp(this.perspMatrix, 800, 600);
}

module.exports = GLState;