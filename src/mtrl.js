'use strict';

var Solid = require('./solid.js');
var data = require('./data.js');

module.exports = Mtrl;

var _materialIndex = 0;

function Mtrl(name) {
  if (!(this instanceof Mtrl)) {
    return new Mtrl(name);
  }

  this.name = name;
  this.flagsPerPass = [ 0 ];

  // DOM image
  this._image = null;
  // GL texture
  this.texture = null;

  // TODO
  this.diffuse = null;
  this.ambient = null;
  this.specular = null;
  this.emission = null;
  this.shininess = -0.0;

  this.id = 'Mtrl:' + _materialIndex++;
}

Mtrl.fromSolMtrl = function (sol, mi) {
  var solMtrl = sol.mtrls[mi];
  var mtrl = Mtrl(solMtrl.f);

  var passCount = getPassCountFromSolMtrl(solMtrl);

  mtrl.flagsPerPass = new Array(passCount);

  for (var passIndex = 0; passIndex < passCount; ++passIndex) {
    mtrl.flagsPerPass[passIndex] = getFlagsFromSolMtrl(solMtrl, passIndex);
  }

  mtrl.diffuse = solMtrl.d;
  mtrl.ambient = solMtrl.a;
  mtrl.specular = solMtrl.s;
  mtrl.emission = solMtrl.e;
  mtrl.shininess = solMtrl.h;

  return mtrl;
};

Mtrl.DEPTH_WRITE = (1 << 0);
Mtrl.DEPTH_TEST = (1 << 1);
Mtrl.BLEND = (1 << 2);
Mtrl.ADDITIVE = (1 << 3);
Mtrl.POLYGON_OFFSET = (1 << 4);
Mtrl.CULL_FACE_BACK = (1 << 5);
Mtrl.CULL_FACE_FRONT = (1 << 6);
Mtrl.CLAMP_T = (1 << 7); // TODO: move this elsewhere.
Mtrl.CLAMP_S = (1 << 8); // TODO: move this elsewhere.

/**
 * Count passes for this material.
 */
function getPassCountFromSolMtrl(solMtrl) {
  var passCount = 1;
  var solFlags = solMtrl.fl;

  if (solFlags & Solid.MTRL_TWO_SIDED_SEPARATE) {
    passCount = 2;
  }

  return passCount;
}

/**
 * Break down SOL material flags into GL state changes.
 */
function getFlagsFromSolMtrl (solMtrl, passIndex = 0) {
  var solFlags = solMtrl.fl;
  var flags = Mtrl.DEPTH_TEST;

  if (!(solFlags & Solid.MTRL_TRANSPARENT)) {
    flags |= Mtrl.DEPTH_WRITE;
  }

  if ((solFlags & Solid.MTRL_TRANSPARENT) || (solFlags & Solid.MTRL_ADDITIVE)) {
    flags |= Mtrl.BLEND;
  }

  if (solFlags & Solid.MTRL_ADDITIVE) {
    flags |= Mtrl.ADDITIVE;
  }

  if (solFlags & Solid.MTRL_DECAL) {
    flags |= Mtrl.POLYGON_OFFSET;
  }

  if (solFlags & Solid.MTRL_TWO_SIDED_SEPARATE) {
    if (passIndex === 0) {
      // First pass: cull front-facing polygons.
      flags |= Mtrl.CULL_FACE_FRONT;
    } else {
      // Second pass: cull back-facing polygons.
      flags |= Mtrl.CULL_FACE_BACK;
    }
  } else {
    if (solFlags & Solid.MTRL_TWO_SIDED) {
      // No culling.
    } else {
      // Default culling.
      flags |= Mtrl.CULL_FACE_BACK;
    }
  }

  if (solFlags & Solid.MTRL_CLAMP_T) {
    flags |= Mtrl.CLAMP_T;
  }

  if (solFlags & Solid.MTRL_CLAMP_S) {
    flags |= Mtrl.CLAMP_S;
  }

  return flags;
}

/*
 * Create a GL texture from the given image.
 */
Mtrl.prototype.createTexture = function (state) {
  if (!this._image) {
    throw Error('Attempted to create material texture without image data')
  }

  var flags = this.flagsPerPass[0]; // TODO

  var gl = state.gl;
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
    flags & Mtrl.CLAMP_S ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
    flags & Mtrl.CLAMP_T ? gl.CLAMP_TO_EDGE : gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.texture = tex;
};

Mtrl.prototype.setImage = function (img) {
  this._image = img;
}

/*
 * Apply material state.
 */
Mtrl.prototype.apply = function (state, passIndex = 0) {
  var mtrl = this;
  var gl = state.gl;

  if (mtrl.texture && state.enableTextures) {
    state.bindTexture(gl.TEXTURE_2D, mtrl.texture);
  } else {
    state.bindTexture(gl.TEXTURE_2D, state.defaultTexture);
  }

  // TODO color cache
  var uniforms = state.uniforms;

  uniforms.uTexture.value = 0;

  uniforms.uDiffuse.value = mtrl.diffuse;
  uniforms.uAmbient.value = mtrl.ambient;
  uniforms.uSpecular.value = mtrl.specular;
  uniforms.uEmissive.value = mtrl.emission;
  uniforms.uShininess.value = mtrl.shininess;

  var flags = mtrl.flagsPerPass[passIndex];

  if (flags & Mtrl.DEPTH_WRITE) {
    state.depthMask(true);
  } else {
    state.depthMask(false);
  }

  if (flags & Mtrl.DEPTH_TEST) {
    state.enable(gl.DEPTH_TEST);
  } else {
    state.disable(gl.DEPTH_TEST);
  }

  if (flags & Mtrl.BLEND) {
    state.enable(gl.BLEND);
  } else {
    state.disable(gl.BLEND);
  }

  if (flags & Mtrl.ADDITIVE) {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  if (flags & Mtrl.POLYGON_OFFSET) {
    state.enable(gl.POLYGON_OFFSET_FILL);
    state.polygonOffset(-1.0, -2.0);
  } else {
    state.polygonOffset(0.0, 0.0);
    state.disable(gl.POLYGON_OFFSET_FILL);
  }

  if ((flags & Mtrl.CULL_FACE_BACK) || (flags & Mtrl.CULL_FACE_FRONT)) {
    state.enable(gl.CULL_FACE);
    state.cullFace((flags & Mtrl.CULL_FACE_FRONT) ? gl.FRONT : gl.BACK);
  } else {
    state.disable(gl.CULL_FACE);
  }
};

/*
 * Create material texture.
 */
Mtrl.prototype.createObjects = function (state) {
  var mtrl = this;

  mtrl.createTexture(state);
};