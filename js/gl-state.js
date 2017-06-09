'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('./util.js');

function GLState() {
  this.defaultTexture = null;

  this.prog = null;

  this.uPerspID = null;
  this.uModelViewID = null;
  this.uTextureID = null;

  this.aPositionID = 0;
  this.aNormalID = 1;
  this.aTexCoordID = 2;

  this.perspMatrix = mat4.create();
  this.modelViewMatrix = mat4.create();
}

GLState.vertShader = `
uniform mat4 uPersp;
uniform mat4 uModelView;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uPersp * uModelView * vec4(aPosition, 1.0);
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

  var data = [
    0xff, 0x00, 0xff, 0xff,
    0xff, 0xff, 0x00, 0xff,
    0x00, 0xff, 0xff, 0xff,
    0xff, 0x00, 0xff, 0xff,
  ];
  
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data));
  gl.bindTexture(gl.TEXTURE_2D, null);
  this.defaultTexture = tex;
}

GLState.prototype.createShaders = function(gl) {
  var vs = GLState.loadShader(gl, gl.VERTEX_SHADER, GLState.vertShader);
  var fs = GLState.loadShader(gl, gl.FRAGMENT_SHADER, GLState.fragShader);

  var prog = gl.createProgram();

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);

  gl.bindAttribLocation(prog, this.aPositionID, 'aPosition');
  gl.bindAttribLocation(prog, this.aNormalID, 'aNormal');
  gl.bindAttribLocation(prog, this.aTexCoordID, 'aTexCoord');

  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(prog));
    return;
  }

  this.uPerspID = gl.getUniformLocation(prog, 'uPersp');
  this.uModelViewID = gl.getUniformLocation(prog, 'uModelView');
  this.uTextureID = gl.getUniformLocation(prog, 'uTexture');

  this.prog = prog;
}

GLState.prototype.calcPerspective = function(w, h) {
  util.calcPersp(this.perspMatrix, 800, 600);
}

module.exports = GLState;