'use strict';

var glsl = require('glslify');
var mat4 = require('gl-matrix').mat4;

var SolidModel = require('./solid-model.js');
var BallModel = require('./ball-model.js');
var View = require('./view.js');
var BillboardMesh = require('./billboard-mesh.js');

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

  this.enabledArrays = []; // TODO

  this.perspMatrix = mat4.create();
  this.viewMatrix = mat4.create();

  this.view = new View();

  this.models = { // TODO
    level: null,
    ball: null,
    coin: null,
    coin5: null,
    coin10: null,
    grow: null,
    shrink: null
  };

  this.billboardMesh = null;

  this.time = 0.0;

  // TODO What's the extent of this?
  if (gl) {
    this.init(gl);
  }
}

// Some WebGL fun:
// 1) Enable premultiplied alpha and appropriate blending.
// 2) Don't ask for an "alpha: false" context.
// 3) Clear draw buffer to zero alpha.
// 4) Composite GL with HTML content.
GLState.composite = false;

GLState.vertShader = glsl.file('../glsl/default.vert');
GLState.fragShader = glsl.file('../glsl/default.frag');

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
  //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.depthFunc(gl.LEQUAL);

  gl.clearColor(0, 0, 0, GLState.composite ? 0.0 : 1.0);

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

  // Create billboard mesh.
  // TODO mesh/model/what?
  this.billboardMesh = new BillboardMesh();
  this.billboardMesh.createVBO(gl);

  this.calcPerspective(gl.canvas.width, gl.canvas.height);
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
  var fov = 50 * Math.PI / 180; // TODO pass as a param?
  var a = w / h;

  // Neverball defaults.
  var n = 0.1;
  var f = 512.0;

  mat4.perspective(this.perspMatrix, fov, a, n, f);
}

GLState.prototype.setModelFromSol = function (gl, modelName, sol) {
  var model = SolidModel.fromSol(sol);
  model.createObjects(gl);
  this.models[modelName] = model;
}

GLState.prototype.setModel = function (gl, modelName, model) {
  model.createObjects(gl);
  this.models[modelName] = model;
}

/*
 * Track vertex attribute array enabled/disabled state.
 * TODO is this per-shader or global? Fuck if I know.
 */
GLState.prototype.enableArray = function(gl, index) {
  if (!this.enabledArrays[index]) {
    gl.enableVertexAttribArray(index);
    this.enabledArrays[index] = true;
  }
}

GLState.prototype.disableArray = function(gl, index) {
  if (this.enabledArrays[index]) {
    gl.disableVertexAttribArray(index);
    this.enabledArrays[index] = false;
  }
}

/*
 * Render everything.
 */
GLState.prototype.draw = function(gl) {
  // game_draw

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (this.prog) {
    // TODO
    gl.useProgram(this.prog);

    gl.uniform1i(this.uTextureID, 0);

    gl.uniformMatrix4fv(this.uPerspID, false, this.perspMatrix);
    gl.uniformMatrix4fv(this.uViewID, false, this.viewMatrix);

    var levelModel = this.models.level;

    if (levelModel) {
      levelModel.drawItems(gl, this);
      levelModel.drawBodies(gl, this);
      levelModel.drawBalls(gl, this);
      levelModel.drawBills(gl, this);
    }

    gl.useProgram(null);
  }
}

GLState.prototype.step = function(dt) {
  this.time += dt;

  for (var name in this.models) {
    var model = this.models[name];

    if (model) {
      model.step(dt);
    }
  }
}

module.exports = GLState;
