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
var opaqueRules = { in: 0, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT | Mtrl.DECAL };
var opaqueDecalRules = { in: Mtrl.DECAL, ex: Mtrl.REFLECTIVE | Mtrl.TRANSPARENT };
var transparentDecalRules = { in: Mtrl.DECAL | Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE };
var transparentRules = { in: Mtrl.TRANSPARENT, ex: Mtrl.REFLECTIVE | Mtrl.DECAL };
var reflectiveRules = { in: Mtrl.REFLECTIVE, ex: 0 };

function testMtrl (rules) {
  return function (mtrl) {
    return ((mtrl.fl & rules.in) === rules.in && (mtrl.fl & rules.ex) === 0);
  };
}

Mtrl.isOpaque = testMtrl(opaqueRules);
Mtrl.isOpaqueDecal = testMtrl(opaqueDecalRules);
Mtrl.isTransparentDecal = testMtrl(transparentDecalRules);
Mtrl.isTransparent = testMtrl(transparentRules);
Mtrl.isReflective = testMtrl(reflectiveRules);

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
Mtrl.draw = function (state, mtrl) {
  var gl = state.gl;

  if (state.enableTextures && mtrl.texture) {
    gl.bindTexture(gl.TEXTURE_2D, mtrl.texture);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, state.defaultTexture);
  }

  var uniforms = state.defaultShader.uniforms;

  uniforms.uDiffuse.value = mtrl.d;
  uniforms.uAmbient.value = mtrl.a;
  uniforms.uSpecular.value = mtrl.s;
  uniforms.uEmissive.value = mtrl.e;
  uniforms.uShininess.value = mtrl.h;

  if (mtrl.fl & Mtrl.ENVIRONMENT) {
    uniforms.uEnvironment.value = 1;
  } else {
    uniforms.uEnvironment.value = 0;
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
