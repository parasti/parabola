'use strict';

var Solid = require('./solid.js');

module.exports = Mtrl;

var _materialIndex = 0;

function Mtrl(name) {
  if (!(this instanceof Mtrl)) {
    return new Mtrl(name);
  }

  this.name = name;
  this.flags = 0;

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

  mtrl._image = sol._images[solMtrl.f];

  mtrl.flags = Mtrl.getFlagsFromSolMtrl(solMtrl);

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
Mtrl.CULL_FACE = (1 << 5);
Mtrl.CLAMP_T = (1 << 6); // TODO: move this elsewhere.
Mtrl.CLAMP_S = (1 << 7); // TODO: move this elsewhere.

/**
 * Break down SOL material flags into GL state changes.
 */
Mtrl.getFlagsFromSolMtrl = function (solMtrl) {
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

  if (!(solFlags & Solid.TWO_SIDED)) {
    flags |= Mtrl.CULL_FACE;
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

  var gl = state.gl;
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
    this.flags & Mtrl.CLAMP_S ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
    this.flags & Mtrl.CLAMP_T ? gl.CLAMP_TO_EDGE : gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.texture = tex;
};

/*
 * Apply material state.
 */
Mtrl.prototype.draw = function (state) {
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

  if (mtrl.flags & Mtrl.DEPTH_WRITE) {
    state.depthMask(true);
  } else {
    state.depthMask(false);
  }

  if (mtrl.flags & Mtrl.DEPTH_TEST) {
    state.enable(gl.DEPTH_TEST);
  } else {
    state.disable(gl.DEPTH_TEST);
  }

  if (mtrl.flags & Mtrl.BLEND) {
    state.enable(gl.BLEND);
  } else {
    state.disable(gl.BLEND);
  }

  if (mtrl.flags & Mtrl.ADDITIVE) {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    state.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  if (mtrl.flags & Mtrl.POLYGON_OFFSET) {
    state.enable(gl.POLYGON_OFFSET_FILL);
    state.polygonOffset(-1.0, -2.0);
  } else {
    state.polygonOffset(0.0, 0.0);
    state.disable(gl.POLYGON_OFFSET_FILL);
  }

  if (mtrl.flags & Mtrl.CULL_FACE) {
    state.enable(gl.CULL_FACE);
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
