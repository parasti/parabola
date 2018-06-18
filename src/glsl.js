'use strict';

// glslify.file breaks Chrome auto-mapping, so we keep it separate from the
// other animals.

var glslify = require('glslify');

exports.defaultVertexShader = glslify.file('../glsl/default.vert');
exports.defaultFragmentShader = glslify.file('../glsl/default.frag');