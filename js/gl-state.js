'use strict';

var mat4 = require('gl-matrix').mat4;
var misc = require('./misc.js');

var SolidModel = require('./solid-model.js');
var BallModel = require('./ball-model.js');

function GLState(gl) {
  this.defaultTexture = null;
  this.enableTextures = true;

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
  this.uEnvironment = null;

  this.aPositionID = 0;
  this.aNormalID = 1;
  this.aTexCoordID = 2;

  this.perspMatrix = mat4.create();
  this.viewMatrix = mat4.create();

  if (gl) {
    this.init(gl);
  }

  this.levelModel = null;
  this.coinModel = null; // TODO
  this.growModel = null;
  this.shrinkModel = null;
}

// Some WebGL fun:
// 1) Enable premultiplied alpha and appropriate blending.
// 2) Don't ask for an "alpha: false" context.
// 3) Clear draw buffer to zero alpha.
// 4) Composite GL with HTML content.
GLState.composite = true;

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

struct Light {
  vec4 position;
  vec4 diffuse;
  vec4 ambient;
  vec4 specular;
};

const Light Light0 = Light(
  vec4(-8.0, +32.0, -8.0, 0.0),
  vec4(1.0, 0.8, 0.8, 1.0),
  vec4(0.7, 0.7, 0.7, 1.0),
  vec4(1.0, 0.8, 0.8, 1.0)
);

const Light Light1 = Light(
  vec4(+8.0, +32.0, +8.0, 0.0),
  vec4(0.8, 1.0, 0.8, 1.0),
  vec4(0.7, 0.7, 0.7, 1.0),
  vec4(0.8, 1.0, 0.8, 1.0)
);

uniform vec4 uDiffuse;
uniform vec4 uAmbient;
uniform vec4 uSpecular;
uniform vec4 uEmissive;
uniform float uShininess;
uniform bool uEnvironment;

varying vec4 vLightColor;

vec4 calcLight(Light light, vec4 eyeNormal) {
  // Assume directional lights.
  // TODO specular
  return
    uAmbient * light.ambient +
    max(0.0, dot(eyeNormal, normalize(light.position))) * uDiffuse * light.diffuse;
}

vec2 calcSphereMap(vec3 n) {
  vec3 u = (uView * uModel * vec4(aPosition, 1.0)).xyz;
  vec3 r = u - 2.0 * n * (n * u);
  r.z += 1.0;
  float m = 2.0 * length(r);
  return vec2(r.x / m + 0.5, r.y / m + 0.5);
}

void main() {
  // TODO eye coordinates
  vec4 eyeNormal = vec4(aNormal, 1.0);

  vec4 lightColor =
    uEmissive +
    uAmbient * Light_GlobalAmbient +
    calcLight(Light0, eyeNormal) +
    calcLight(Light1, eyeNormal);

  vLightColor = clamp(vec4(lightColor.rgb, uDiffuse.a), 0.0, 1.0);
  vLightColor.rgb = vLightColor.rgb * vLightColor.a; // Premultiply.

  if (uEnvironment)
    vTexCoord = calcSphereMap(eyeNormal.xyz);
  else
    vTexCoord = aTexCoord;

  gl_Position = uPersp * uView * uModel * vec4(aPosition, 1.0);
}
`;

GLState.fragShader = `
precision highp float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;
varying vec4 vLightColor;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor;
}
`;

/*
 * Obtain a WebGL context. Now IE compatible, whoo.
 */
GLState.getContext = function(canvas) {
  var opts = { depth: true, alpha: GLState.composite };
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
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.depthFunc(gl.LEQUAL);

  gl.clearColor(0, 0, 0, GLState.composite ? 0.1 : 1.0);

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
  this.uEnvironment = gl.getUniformLocation(prog, 'uEnvironment');

  this.prog = prog;
}

/*
 * Compute a Neverball perspective matrix.
 */
GLState.prototype.calcPerspective = function(w, h) {
  // TODO pass fov? for teleport effects
  misc.calcPersp(this.perspMatrix, w, h);
}

GLState.prototype.loadLevel = function(gl, sol) {
  this.levelModel = new SolidModel(gl, sol);
}

GLState.prototype.loadCoin = function(gl, sol) {
  this.coinModel = new SolidModel(gl, sol);
}

GLState.prototype.loadGrow = function(gl, sol) {
  this.growModel = new SolidModel(gl, sol);
}

GLState.prototype.loadShrink = function(gl, sol) {
  this.shrinkModel = new SolidModel(gl, sol);
}

GLState.prototype.loadBall = function(gl, model) {
  this.ballModel = model;
}

GLState.prototype.draw = function(gl) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (this.prog) {
    // TODO
    gl.useProgram(this.prog);

    gl.uniform1i(this.uTextureID, 0);

    gl.uniformMatrix4fv(this.uPerspID, false, this.perspMatrix);
    gl.uniformMatrix4fv(this.uViewID, false, this.viewMatrix);

    gl.enableVertexAttribArray(this.aPositionID);
    gl.enableVertexAttribArray(this.aNormalID);
    gl.enableVertexAttribArray(this.aTexCoordID);

    if (this.levelModel) {
      this.levelModel.drawItems(gl, this);
      this.levelModel.drawBodies(gl, this);
      this.levelModel.drawBalls(gl, this);
    }

    gl.disableVertexAttribArray(this.aPositionID);
    gl.disableVertexAttribArray(this.aNormalID);
    gl.disableVertexAttribArray(this.aTexCoordID);

    gl.useProgram(null);
  }
}

GLState.prototype.step = function(dt) {
  if (this.levelModel) {
    this.levelModel.step(dt);
  }
  if (this.coinModel) {
    this.coinModel.step(dt);
  }
  if (this.growModel) {
    this.growModel.step(dt);
  }
  if (this.shrinkModel) {
    this.shrinkModel.step(dt);
  }
}

module.exports = GLState;