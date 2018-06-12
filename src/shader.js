'use strict';

var glsl = require('glslify');

var Uniform = require('./uniform.js');

module.exports = Shader;

function Shader () {
  if (!(this instanceof Shader)) {
    return new Shader();
  }

  // TODO
  this.program = null;
  this.vertexShader = '';
  this.fragmentShader = '';
  this.uniforms = {};
  this.mangledUniforms = this.uniforms;
  this.uniformLocations = {};
}

Shader.origShader = function () {
  var uniforms = {
    uTexture: Uniform.i(),
    ProjectionMatrix: Uniform.mat4(),
    uDiffuse: Uniform.vec4(),
    uAmbient: Uniform.vec4(),
    uSpecular: Uniform.vec4(),
    uEmissive: Uniform.vec4(),
    uShininess: Uniform.f(),
    uEnvironment: Uniform.i()
  };

  var shader = Shader();

  shader.vertexShader = glsl.file('../glsl/default.vert');
  shader.fragmentShader = glsl.file('../glsl/default.frag');
  shader.uniforms = uniforms;
  shader.mangledUniforms = uniforms;

  return shader;
};

Shader.prototype.use = function (state) {
  var shader = this;
  var program = shader.program;

  if (program) {
    state.useProgram(program);
    return true;
  }

  return false;
};

Shader.prototype.createObjects = function (gl) {
  var shader = this;

  if (shader.program) {
    throw Error('Shader program already exists');
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

  // WIP
  for (var uniform in shader.mangledUniforms) {
    shader.uniformLocations[uniform] = gl.getUniformLocation(prog, uniform);
  }

  shader.program = prog;
};

Shader.prototype.uploadUniforms = function (gl) {
  var shader = this;
  var program = shader.program;

  if (program) {
    var uniforms = shader.mangledUniforms;

    for (var name in uniforms) {
      var location = shader.uniformLocations[name];

      if (location) {
        var uniform = uniforms[name];
        uniform.upload(gl, location);
      }
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