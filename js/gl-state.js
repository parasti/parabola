'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('./util.js');

function GLState(gl) {
  this.defaultTexture = null;

  this.prog = null;

  this.uPerspID = null;
  this.uViewID = null;
  this.uModelID = null;
  this.uTextureID = null;

  this.aPositionID = 0;
  this.aNormalID = 1;
  this.aTexCoordID = 2;

  this.perspMatrix = mat4.create();
  this.viewMatrix = mat4.create();

  if (gl) {
    this.init(gl);
  }

  this.bodies = [];
}

GLState.vertShader = `
uniform mat4 uPersp;
uniform mat4 uView;
uniform mat4 uModel;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uPersp * uView * uModel * vec4(aPosition, 1.0);
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

/*
 * Obtain a WebGL context. Now IE compatible, whoo.
 */
GLState.getContext = function(canvas) {
  var opts = { depth: true };
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

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthFunc(gl.LEQUAL);

  gl.clearColor(0, 0, 0, 1);

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

  this.prog = prog;
}

/*
 * Compute a Neverball perspective matrix.
 */
GLState.prototype.calcPerspective = function(w, h) {
  // TODO pass fov? for teleport effects
  util.calcPersp(this.perspMatrix, w, h);
}

/*
 * Load body meshes and initial transform from SOL.
 */
GLState.prototype.loadBodies = function(sol) {
  this.bodies = [];

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    this.bodies.push({
      meshes: sol.getBodyMeshes(solBody),
      // TODO figure out how to update this w/o linking to SOL
      matrix: sol.getBodyTransform(solBody)
    });
  }
}

/*
 * Create body mesh VBOs and textures.
 */
GLState.prototype.loadBodyMeshes = function(gl) {
  for (var i = 0; i < this.bodies.length; ++i) {
    var meshes = this.bodies[i].meshes;

    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];
      mesh.createVBO(gl);
      // TODO Keep a shared material cache instead of per-SOL?
      mesh.mtrl.loadTexture(gl);
    }
  }
}

/*
 * Render body meshes.
 */
GLState.prototype.drawBodies = function(gl) {
  var bodies = this.bodies;

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];

    // TODO do the math on the CPU
    gl.uniformMatrix4fv(this.uModelID, false, body.matrix);

    var meshes = body.meshes;
    for (var j = 0; j < meshes.length; ++j) {
      meshes[j].draw(gl, this);
    }
  }
}

GLState.prototype.draw = function(gl) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (this.prog) {
    // TODO
    gl.useProgram(this.prog);

    gl.uniform1i(this.uTextureID, 0);

    gl.uniformMatrix4fv(this.uPerspID, false, this.perspMatrix);
    gl.uniformMatrix4fv(this.uViewID, false, this.viewMatrix);

    this.drawBodies(gl);

    gl.useProgram(null);
  }
}

module.exports = GLState;