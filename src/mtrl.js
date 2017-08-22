'use strict';

var data = require('./data.js');
var mtrlImages = require('./mtrl-images.json');

var Mtrl = {};

/*
 * Material type flags.
 */
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
 * Material sorting rules.
 */
Mtrl.opaqueRules = { in: 0, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT | Mtrl.DECAL };
Mtrl.opaqueDecalRules = { in: Mtrl.DECAL, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT };
Mtrl.transparentDecalRules = { in: Mtrl.DECAL | Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE };
Mtrl.transparentRules = { in: Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE | Mtrl.DECAL };
Mtrl.reflectiveRules = { in: Mtrl.REFLECTIVE, ex: 0 };

Mtrl.test = function (mtrl, rules) {
  return ((mtrl.fl & rules.in) === rules.in && (mtrl.fl & rules.ex) === 0);
}

Mtrl.isOpaque = function (mtrl) {
  return Mtrl.test(mtrl, Mtrl.opaqueRules);
}

Mtrl.isOpaqueDecal = function (mtrl) {
  return Mtrl.test(mtrl, Mtrl.opaqueDecalRules);
}

Mtrl.isTransparentDecal = function (mtrl) {
  return Mtrl.test(mtrl, Mtrl.transparentDecalRules);
}

Mtrl.isTransparent = function (mtrl) {
  return Mtrl.test(mtrl, Mtrl.transparentRules);
}

Mtrl.isReflective = function (mtrl) {
  return Mtrl.test(mtrl, Mtrl.reflectiveRules);
}

/*
 * Create a GL texture from the given image.
 */
Mtrl.createTexture = function (gl, mtrl) {
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
      mtrl.fl & Mtrl.CLAMP_S ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
      mtrl.fl & Mtrl.CLAMP_T ? gl.CLAMP_TO_EDGE : gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mtrl.image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  mtrl.texture = tex;
};

/*
 * Apply material state.
 */
Mtrl.draw = function (gl, state, mtrl) {
  // TODO shadow state locally

  if (state.enableTextures && mtrl.texture) {
    gl.bindTexture(gl.TEXTURE_2D, mtrl.texture);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, state.defaultTexture);
  }

  gl.uniform4fv(state.uDiffuse, mtrl.d);
  gl.uniform4fv(state.uAmbient, mtrl.a);
  gl.uniform4fv(state.uSpecular, mtrl.s);
  gl.uniform4fv(state.uEmissive, mtrl.e);
  gl.uniform1f(state.uShininess, mtrl.h);

  if (mtrl.fl & Mtrl.ENVIRONMENT) {
    gl.uniform1i(state.uEnvironment, 1);
  } else {
    gl.uniform1i(state.uEnvironment, 0);
  }

  if (mtrl.fl & Mtrl.ADDITIVE) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  if (mtrl.fl & Mtrl.TWO_SIDED) {
    gl.disable(gl.CULL_FACE);
  } else {
    gl.enable(gl.CULL_FACE);
  }

  if (mtrl.fl & Mtrl.DECAL) {
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1.0, -2.0);
  } else {
    gl.polygonOffset(0.0, 0.0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
};

/*
 * Download material image and create a texture.
 */
Mtrl.loadTexture = function (gl, mtrl) {
  if (mtrl._loading) {
    return;
  }
  if (mtrl.image) {
    throw Error('Material image for ' + mtrl.f + ' has already been loaded');
  }

  var imagePath = mtrlImages[mtrl.f];
  if (!imagePath) {
    throw Error('Material image for ' + mtrl.f + ' is unknown');
  }

  mtrl._loading = true;
  data.fetchImage(imagePath).then(function (image) {
    mtrl.image = image;
    Mtrl.createTexture(gl, mtrl);
    delete mtrl._loading;
  });
};

/*
 * Exports.
 */
module.exports = Mtrl;