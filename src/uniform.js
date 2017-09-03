'use strict';

var Uniform = module.exports = function () {
  throw Error('Use a typed Uniform creator');
};

function makeUniform (type) {
  var uniform = Object.create(Uniform.prototype);

  return Object.assign(uniform, {
    type: type,
    value: allocValue(type)
  });
}

Uniform.i = () => makeUniform('i');
Uniform.f = () => makeUniform('f');
Uniform.vec2 = () => makeUniform('vec2');
Uniform.vec3 = () => makeUniform('vec3');
Uniform.vec4 = () => makeUniform('vec4');
Uniform.mat3 = () => makeUniform('mat3');
Uniform.mat4 = () => makeUniform('mat4');

Uniform.copyValue = function (output, input) {
  if (output.type !== input.type) {
    throw Error('Uniform input is ' + input.type + ', but expected ' + output.type);
  }
  output.value = input.value;
};

Uniform.prototype.upload = function (gl, location) {
  var uniform = this;

  switch (uniform.type) {
    case 'i': gl.uniform1i(location, uniform.value); break;
    case 'f': gl.uniform1f(location, uniform.value); break;
    case 'vec2': gl.uniform2fv(location, uniform.value); break;
    case 'vec3': gl.uniform3fv(location, uniform.value); break;
    case 'vec4': gl.uniform4fv(location, uniform.value); break;
    case 'mat3': gl.uniformMatrix3fv(location, false, uniform.value); break;
    case 'mat4': gl.uniformMatrix4fv(location, false, uniform.value); break;
    default: throw Error('Unknown uniform type ' + uniform.type);
  }
};

function allocValue (type) {
  var value = 0;

  switch (type) {
    case 'i': value = 0; break;
    case 'f': value = 0.0; break;
    case 'vec2': value = new Float32Array(2); break;
    case 'vec3': value = new Float32Array(3); break;
    case 'vec4': value = new Float32Array(4); break;
    case 'mat3': value = new Float32Array(9); break;
    case 'mat4': value = new Float32Array(16); break;
    default: throw Error('Unknown uniform type ' + type);
  }

  return value;
}
