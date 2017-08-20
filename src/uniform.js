'use strict';

var Uniform = module.exports = function (type) {
  return {
    type: type,
    value: allocValue(type)
  }
}

Uniform.upload = function (gl, program, name, uniform) {
  // TODO cache this
  var location = gl.getUniformLocation(program, name);

  // TODO this does a string match during a draw frame.
  switch (uniform.type) {
    case 'i': gl.uniform1i(location, uniform.value); break;
    case 'f': gl.uniform1f(location, uniform.value); break;
    case 'vec2': gl.uniform2fv(location, uniform.value); break;
    case 'vec3': gl.uniform3fv(location, uniform.value); break;
    case 'vec4': gl.uniform4fv(location, uniform.value); break;
    case 'mat3': gl.uniformMatrix3fv(location, false, uniform.value); break;
    case 'mat4': gl.uniformMatrix4fv(location, false, uniform.value); break;
  }
}

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