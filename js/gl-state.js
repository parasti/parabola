'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('./util.js');

var GLSolid = require('./gl-solid.js');

function GLState(gl) {
  this.defaultTexture = null;

  this.prog = null;

  this.uPerspID = null;
  this.uViewID = null;
  this.uModelID = null;
  this.uTextureID = null;

  this.uDiffuse = null;
  this.uAmbient = null;
  this.uSpecular = null;
  this.uEmissive = null;
  this.uShininess = null;

  this.aPositionID = 0;
  this.aNormalID = 1;
  this.aTexCoordID = 2;

  this.perspMatrix = mat4.create();
  this.viewMatrix = mat4.create();

  if (gl) {
    this.init(gl);
  }

  this.levelModel = null;
}

GLState.vertShader = `

uniform mat4 uPersp;
uniform mat4 uView;
uniform mat4 uModel;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

//
// Lighting
//
const float Light_GlobalAmbient = 0.2;

// Assume directional lights.

struct Light {
  vec3 position;
  vec3 diffuse;
  vec3 ambient;
  vec3 specular;
};

const Light Light0 = Light(
  vec3(-8.0, +32.0, -8.0),
  vec3(1.0, 0.8, 0.8),
  vec3(0.7, 0.7, 0.7),
  vec3(1.0, 0.8, 0.8)
);

const Light Light1 = Light(
  vec3(+8.0, +32.0, +8.0),
  vec3(0.8, 1.0, 0.8),
  vec3(0.7, 0.7, 0.7),
  vec3(0.8, 1.0, 0.8)
);

uniform vec4 uDiffuse;
uniform vec3 uAmbient;
uniform vec3 uSpecular;
uniform vec3 uEmissive;
uniform float uShininess;

varying vec4 vLightColor;

vec3 calcLight(Light L) {
  return
    uAmbient * L.ambient +
    max(0.0, dot(aNormal, normalize(L.position))) * uDiffuse.rgb * L.diffuse;
}

void main() {
  vec3 lightColor =
    uEmissive +
    uAmbient * Light_GlobalAmbient +
    //calcLight(Light0) +
    calcLight(Light1);

  vLightColor = vec4(lightColor, uDiffuse.a);

  vTexCoord = aTexCoord;
  gl_Position = uPersp * uView * uModel * vec4(aPosition, 1.0);
}
`;

// TODO lighting

GLState.fragShader = `
precision highp float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;
varying vec4 vLightColor;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor;
  //gl_FragColor = vLightColor;
}
`;

/*
 * Obtain a WebGL context. Now IE compatible, whoo.
 */
GLState.getContext = function(canvas) {
  var opts = { depth: true, alpha: false };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  return gl;
}

/*
 * Obtain a WebGL context and set some defaults.
 */
GLState.initGL = function(canvas) {
  var gl = GLState.getContext(canvas);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  // Straight alpha vs premultiplied alpha:
  // https://limnu.com/webgl-blending-youre-probably-wrong/
  // https://developer.nvidia.com/content/alpha-blending-pre-or-not-pre
  //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.depthFunc(gl.LEQUAL);

  gl.clearColor(1, 0, 0, 1);

  // Fix upside down images.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // This does nothing.
  gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST);

  return gl;
}

GLState.loadShader = function(gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/*
 * Initialize some state.
 */
GLState.prototype.init = function(gl) {
  this.createDefaultTexture(gl);
  this.createShaders(gl);
  this.calcPerspective(canvas.width, canvas.height);
}

/*
 * WebGL spams console when sampling an unbound texture, so we bind this.
 */
GLState.prototype.createDefaultTexture = function(gl) {
  if (this.defaultTexture) {
    console.warn('Attempted to remake default texture');
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

/*
 * Make the default shader program.
 */
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
  this.uViewID = gl.getUniformLocation(prog, 'uView');
  this.uModelID = gl.getUniformLocation(prog, 'uModel');
  this.uTextureID = gl.getUniformLocation(prog, 'uTexture');

  this.uDiffuse = gl.getUniformLocation(prog, 'uDiffuse');
  this.uAmbient = gl.getUniformLocation(prog, 'uAmbient');
  this.uSpecular = gl.getUniformLocation(prog, 'uSpecular');
  this.uEmissive = gl.getUniformLocation(prog, 'uEmissive');
  this.uShininess = gl.getUniformLocation(prog, 'uShininess');

  this.prog = prog;
}

/*
 * Compute a Neverball perspective matrix.
 */
GLState.prototype.calcPerspective = function(w, h) {
  // TODO pass fov? for teleport effects
  util.calcPersp(this.perspMatrix, w, h);
}

GLState.prototype.loadLevel = function(gl, sol) {
  var model = new GLSolid();

  model.loadBodies(sol);
  model.loadBodyMeshes(gl);

  this.levelModel = model;
}

GLState.prototype.draw = function(gl) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (this.prog) {
    // TODO
    gl.useProgram(this.prog);

    gl.uniform1i(this.uTextureID, 0);

    gl.uniformMatrix4fv(this.uPerspID, false, this.perspMatrix);
    gl.uniformMatrix4fv(this.uViewID, false, this.viewMatrix);

    if (this.levelModel) {
      this.levelModel.drawBodies(gl, this);
    }

    gl.useProgram(null);
  }
}

module.exports = GLState;