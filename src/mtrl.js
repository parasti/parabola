'use strict';

var data = require('./data.js');
var mtrlImages = require('./mtrl-images.json');

module.exports = Mtrl;

var _materialIndex = 0;

function Mtrl (name) {
  if (!(this instanceof Mtrl)) {
    return new Mtrl(name);
  }

  this.name = name;
  this.flags = 0;

  // DOM image
  this.image = null;
  // GL texture
  this.texture = null;

  // Image fetch promise
  this._imageProm = null;

  // TODO
  this.diffuse = null;
  this.ambient = null;
  this.specular = null;
  this.emission = null;
  this.shininess = null;

  this.id = _materialIndex++;
}

Mtrl.fromSolMtrl = function (solMtrl) {
  var mtrl = Mtrl(solMtrl.f);

  mtrl.fetchImage();

  mtrl.flags = decomposeFlags(solMtrl.fl);

  mtrl.diffuse = solMtrl.d;
  mtrl.ambient = solMtrl.a;
  mtrl.specular = solMtrl.s;
  mtrl.emission = solMtrl.e;
  mtrl.shininess = solMtrl.h;

  return mtrl;
};

function decomposeFlags (fl) {
  var flags = fl | Mtrl._DEPTH_TEST;

  if (flags & Mtrl.TRANSPARENT) {
    flags |= Mtrl._BLEND;
    flags &= ~Mtrl._DEPTH_WRITE;
  } else {
    flags &= ~Mtrl._BLEND;
    flags |= Mtrl._DEPTH_WRITE;
  }

  // TODO:
  // Mtrl.PARTICLE (TODO entirely)
  // Mtrl.REFLECTIVE (combo material: stencil pass, transparent pass)
  // Mtrl.SHADOWED (separate shader + some state)
  // Mtrl.CLAMP_S (tex param)
  // Mtrl.CLAMP_T (tex param)

  return flags;
}

// Decomposed flags.
Mtrl._DEPTH_TEST = (1 << 14);
Mtrl._DEPTH_WRITE = (1 << 13);
Mtrl._BLEND = (1 << 12);

// Neverball flags.
Mtrl.LIT = (1 << 11);
Mtrl.PARTICLE = (1 << 10);
Mtrl.ALPHA_TEST = (1 << 9);
Mtrl.REFLECTIVE = (1 << 8);
Mtrl.TRANSPARENT = (1 << 7);
Mtrl.SHADOWED = (1 << 6);
Mtrl.DECAL = (1 << 5);
Mtrl.ENVIRONMENT = (1 << 4);
Mtrl.TWO_SIDED = (1 << 3);
Mtrl.ADDITIVE = (1 << 2);
Mtrl.CLAMP_S = (1 << 1);
Mtrl.CLAMP_T = (1 << 0);

/*
 * Create a GL texture from the given image.
 */
Mtrl.prototype.createTexture = function (state) {
  var gl = state.gl;
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
      this.flags & Mtrl.CLAMP_S ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
      this.flags & Mtrl.CLAMP_T ? gl.CLAMP_TO_EDGE : gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
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

  // TODO caching
  var uniforms = state.uniforms;

  uniforms.uTexture.value = 0;

  uniforms.uDiffuse.value = mtrl.diffuse;
  uniforms.uAmbient.value = mtrl.ambient;
  uniforms.uSpecular.value = mtrl.specular;
  uniforms.uEmissive.value = mtrl.emission;
  uniforms.uShininess.value = mtrl.shininess;

  if (mtrl.flags & Mtrl._BLEND) {
    gl.enable(gl.BLEND);
  } else {
    gl.disable(gl.BLEND);
  }

  if (mtrl.flags & Mtrl._DEPTH_WRITE) {
    gl.depthMask(true);
  } else {
    gl.depthMask(false);
  }

  if (mtrl.flags & Mtrl._DEPTH_TEST) {
    gl.enable(gl.DEPTH_TEST);
  } else {
    gl.disable(gl.DEPTH_TEST);
  }

  if (mtrl.flags & Mtrl.ADDITIVE) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  if (mtrl.flags & Mtrl.TWO_SIDED) {
    gl.disable(gl.CULL_FACE);
  } else {
    gl.enable(gl.CULL_FACE);
  }

  if (mtrl.flags & Mtrl.DECAL) {
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1.0, -2.0);
  } else {
    gl.polygonOffset(0.0, 0.0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
};

/*
 * Download material image.
 */
Mtrl.prototype.fetchImage = function () {
  var mtrl = this;

  if (!mtrl._imageProm) {
    var imagePath = mtrlImages[mtrl.name];
    if (!imagePath) {
      console.warn(Error('Material image for ' + mtrl.name + ' is unknown'));
      return;
    }

    mtrl._imageProm = data.fetchImage(imagePath).then(function (image) {
      mtrl.image = image;
    });
  }
};

/*
 * Create material texture.
 */
Mtrl.prototype.createObjects = function (state) {
  var mtrl = this;

  if (!mtrl._imageProm) {
    throw Error('Attempted to create material texture without fetching it first');
  }

  mtrl._imageProm.then(function () {
    mtrl.createTexture(state);
  });
};
