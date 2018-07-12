'use strict';

var Solid = require('neverball-solid');

module.exports = Shader;

function Shader (flags) {
  if (!(this instanceof Shader)) {
    return new Shader(flags);
  }

  this.program = null;
  this.vertexShader = '';
  this.fragmentShader = '';
  this.uniformLocations = {};
  this.flags = (flags || 0);

  this.buildShaders();
}

Shader.LIT = 0x1;
Shader.ENVIRONMENT = 0x2;

Shader.prototype.buildShaders = function () {
  var defs = getDefsFromFlags(this.flags);

  this.vertexShader = defs + require('./glsl.js').defaultVertexShader;
  this.fragmentShader = defs + require('./glsl.js').defaultFragmentShader;
};

function getDefsFromFlags (flags) {
  var defs = '';

  if (flags & Shader.LIT) {
    defs += '#define M_LIT 1\n';
  }
  if (flags & Shader.ENVIRONMENT) {
    defs += '#define M_ENVIRONMENT 1\n';
  }

  return defs;
}

Shader.getFlagsFromSolMtrl = function (solMtrl) {
  var flags = 0;

  if (solMtrl.fl & Solid.MTRL_LIT) {
    flags |= Shader.LIT;
  }
  if (solMtrl.fl & Solid.MTRL_ENVIRONMENT) {
    flags |= Shader.ENVIRONMENT;
  }

  return flags;
};

Shader.fromSolMtrl = function (mtrl) {
  var flags = Shader.getFlagsFromSolMtrl(mtrl);
  var shader = Shader(flags);
  return shader;
};

Shader.prototype.use = function (state) {
  var program = this.program;

  if (program) {
    state.useProgram(program);
  }
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
