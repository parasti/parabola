'use strict';

var Uniform = require('./uniform.js');
var Solid = require('neverball-solid');

module.exports = Shader;

function Shader () {
  if (!(this instanceof Shader)) {
    return new Shader();
  }

  this.program = null;
  this.vertexShader = '';
  this.fragmentShader = '';
  this.uniformLocations = {};
}

Shader.fromSolMtrl = function (mtrl) {
  var defs = '';

  var shader = Shader();

  if (mtrl.fl & Solid.MTRL_LIT) {
    defs += '#define M_LIT\n';
  }

  if (mtrl.fl & Solid.MTRL_ENVIRONMENT) {
    defs += '#define M_ENVIRONMENT\n';
  }

  shader.vertexShader = defs + require('./glsl.js').defaultVertexShader;
  shader.fragmentShader = defs + require('./glsl.js').defaultFragmentShader;

  return shader;
}

Shader.prototype.use = function (state) {
  var shader = this;
  var program = shader.program;

  if (program) {
    state.useProgram(program);
    return true;
  }

  return false;
};

Shader.prototype.createObjects = function (state) {
  var shader = this;
  var gl = state.gl;

  if (shader.program) {
    console.warn('Shader program already exists');
    return;
  }

  var vs = compileShaderSource(gl, gl.VERTEX_SHADER, shader.vertexShader);
  var fs = compileShaderSource(gl, gl.FRAGMENT_SHADER, shader.fragmentShader);

  var prog = gl.createProgram();

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);

  // TODO unhardcode or something.

  gl.bindAttribLocation(prog, 0, 'aPosition');
  gl.bindAttribLocation(prog, 1, 'aNormal');
  gl.bindAttribLocation(prog, 2, 'aTexCoord');
  gl.bindAttribLocation(prog, 3, 'aModelViewMatrix');

  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw gl.getProgramInfoLog(prog);
  }

  // Cache uniform locations that we want from the shader.

  for (var name in state.uniforms) {
    var location = gl.getUniformLocation(prog, name);

    if (location) {
      shader.uniformLocations[name] = location;
    }
  }

  shader.program = prog;
};

Shader.prototype.uploadUniforms = function (state) {
  var gl = state.gl;
  var shader = this;
  var program = shader.program;

  if (program) {
    var uniformLocations = shader.uniformLocations;

    for (var name in uniformLocations) {
      var uniform = state.uniforms[name];
      var location = uniformLocations[name];

      uniform.upload(gl, location);
    }
  }
};

function compileShaderSource (gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw gl.getShaderInfoLog(shader);
  }
  return shader;
}
