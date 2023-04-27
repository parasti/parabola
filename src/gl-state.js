'use strict';

var Uniform = require('./uniform.js');

module.exports = GLState;

function GLState(canvas) {
  if (!(this instanceof GLState)) {
    return new GLState(canvas);
  }

  this.enableTextures = true;

  this.vertexAttrs = {
    Position: 0,
    Normal: 1,
    TexCoord: 2,
    ModelViewMatrix: 3 // and 4, 5, 6. Maximum is 8 attribute locations.
  };

  this.uniforms = {
    uTexture: Uniform.i(),
    ProjectionMatrix: Uniform.mat4(),
    ViewMatrix: Uniform.mat4(),
    uDiffuse: Uniform.vec4(),
    uAmbient: Uniform.vec4(),
    uSpecular: Uniform.vec4(),
    uEmissive: Uniform.vec4(),
    uShininess: Uniform.f(),
    uEnvironment: Uniform.i()
  };

  this.init(canvas);
}

GLState.prototype.init = function (canvas) {
  var gl = this.gl = getContext(canvas);

  setupContext(gl);

  this.defaultTexture = null;
  this.boundTextures = [];
  this.enabledCapabilities = [];
  this.shadowState = {
    currentProgram: gl.getParameter(gl.CURRENT_PROGRAM),
    blendSrcRGB: gl.getParameter(gl.BLEND_SRC_RGB),
    blendDstRGB: gl.getParameter(gl.BLEND_DST_RGB),
    depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),
    cullFaceMode: gl.getParameter(gl.CULL_FACE_MODE),
    polygonOffsetFactor: gl.getParameter(gl.POLYGON_OFFSET_FACTOR),
    polygonOffsetUnits: gl.getParameter(gl.POLYGON_OFFSET_UNITS)
  };

  // Extensions.
  this.instancedArrays = this.gl.getExtension('ANGLE_instanced_arrays');
  this.vertexArrayObject = this.gl.getExtension('OES_vertex_array_object');
  this.loseContext = this.gl.getExtension('WEBGL_lose_context');

  this.createDefaultObjects();
}

GLState.prototype.cullFace = function (mode) {
  if (this.shadowState.cullFaceMode !== mode) {
    this.gl.cullFace(mode);
    this.shadowState.cullFaceMode = mode;
  }
}

GLState.prototype.depthMask = function (mask) {
  if (this.shadowState.depthMask !== mask) {
    this.gl.depthMask(mask);
    this.shadowState.depthMask = mask;
  }
};

GLState.prototype.bindTexture = function (target, texture) {
  if (this.boundTextures[target] !== texture) {
    this.gl.bindTexture(target, texture);
    this.boundTextures[target] = texture;
  }
};

GLState.prototype.useProgram = function (program) {
  if (this.shadowState.currentProgram !== program) {
    this.gl.useProgram(program);
    this.shadowState.currentProgram = program;
  }
};

GLState.prototype.enable = function (cap) {
  if (this.enabledCapabilities[cap] !== true) {
    this.gl.enable(cap);
    this.enabledCapabilities[cap] = true;
  }
};

GLState.prototype.disable = function (cap) {
  if (this.enabledCapabilities[cap] !== false) {
    this.gl.disable(cap);
    this.enabledCapabilities[cap] = false;
  }
};

GLState.prototype.blendFunc = function (src, dst) {
  if (this.shadowState.blendSrcRGB !== src || this.shadowState.blendDstRGB !== dst) {
    this.gl.blendFunc(src, dst);
    this.shadowState.blendSrcRGB = src;
    this.shadowState.blendDstRGB = dst;
  }
}

GLState.prototype.polygonOffset = function (factor, units) {
  if (this.shadowState.polygonOffsetFactor !== factor || this.shadowState.polygonOffsetUnits !== units) {
    this.gl.polygonOffset(factor, units);
    this.shadowState.polygonOffsetFactor = factor;
    this.shadowState.polygonOffsetUnits = units;
  }
}

GLState.prototype.createVertexArray = function () {
  return this.vertexArrayObject.createVertexArrayOES();
};

GLState.prototype.bindVertexArray = function (vao) {
  this.vertexArrayObject.bindVertexArrayOES(vao);
};

GLState.prototype.vertexAttribDivisor = function (index, divisor) {
  this.instancedArrays.vertexAttribDivisorANGLE(index, divisor);
};

GLState.prototype.drawElementsInstanced = function (mode, count, type, offset, primcount) {
  this.instancedArrays.drawElementsInstancedANGLE(mode, count, type, offset, primcount);
};

/**
 * Obtain a WebGL context.
 *
 * @param {HTMLCanvasElement} canvas canvas element
 * @returns {?WebGLRenderingContext}
 */
function getContext(canvas) {
  var opts = { depth: true, alpha: false };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  return gl;
}

/**
 * Set up some defaults.
 *
 * @param {WebGLRenderingContext} gl
 */
function setupContext(gl) {
  // Straight alpha vs premultiplied alpha:
  // https://limnu.com/webgl-blending-youre-probably-wrong/
  // https://developer.nvidia.com/content/alpha-blending-pre-or-not-pre
  // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Fix upside down images.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
}

/*
 * TODO
 */
GLState.prototype.createDefaultObjects = function () {
  var gl = this.gl;

  this.defaultTexture = this.createDefaultTexture(gl);
};

/*
 * WebGL spams console when sampling an unbound texture, so we bind this.
 */
GLState.prototype.createDefaultTexture = function (gl) {
  var data = [
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff
  ];

  var tex = gl.createTexture();
  this.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data));
  this.bindTexture(gl.TEXTURE_2D, null);
  return tex;
};