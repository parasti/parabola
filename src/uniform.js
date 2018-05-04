'use strict';

const uniformAllocators = {
  i: () => 0,
  f: () => 0.0,
  vec2: () => new Float32Array(2),
  vec3: () => new Float32Array(3),
  vec4: () => new Float32Array(4),
  mat3: () => new Float32Array(9),
  mat4: () => new Float32Array(16)
};

const uniformUploaders = {
  i: function (gl, loc) { gl.uniform1i(loc, this.value); },
  f: function (gl, loc) { gl.uniform1f(loc, this.value); },
  vec2: function (gl, loc) { gl.uniform2fv(loc, this.value); },
  vec3: function (gl, loc) { gl.uniform3fv(loc, this.value); },
  vec4: function (gl, loc) { gl.uniform4fv(loc, this.value); },
  mat3: function (gl, loc) { gl.uniformMatrix3fv(loc, false, this.value); },
  mat4: function (gl, loc) { gl.uniformMatrix4fv(loc, false, this.value); }
};

for (let type in uniformAllocators) {
  module.exports[type] = function () {
    return {
      value: uniformAllocators[type](),
      upload: uniformUploaders[type]
    };
  };
}
