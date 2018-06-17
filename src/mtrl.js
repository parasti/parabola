'use strict';

var data = require('./data.js');
var mtrlImages = require('./mtrl-images.json');
var Shader = require('./shader.js');

module.exports = Mtrl;

function Mtrl() {
  if (!(this instanceof Mtrl)) {
    return new Mtrl();
  }

  this.name = '';
  this.flags = 0;

  // DOM image
  this.image = null;
  // GL texture
  this.texture = null;

  // Image fetch promise
  this._imageProm = null;

  // TODO
  this.diffuseColor = null;
  this.ambientColor = null;
  this.specularColor = null;
  this.emissiveColor = null;
  this.shininess = null;

  this.shader = null;
}

Mtrl.fromSolMtrl = function (solMtrl) {
  var mtrl = Mtrl();

  mtrl.name = solMtrl.f;
  mtrl.fetchImage();
  mtrl.flags = solMtrl.fl;

  mtrl.diffuseColor = solMtrl.d;
  mtrl.ambientColor = solMtrl.a;
  mtrl.specularColor = solMtrl.s;
  mtrl.emissiveColor = solMtrl.e;
  mtrl.shininess = solMtrl.h;

  // TODO
  mtrl.shader = Shader.fromSolMtrl(solMtrl);

  return mtrl;
}

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
 * Create a GL texture from the given image.
 */
Mtrl.prototype.createTexture = function (gl) {
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
  var shader = mtrl.shader;

  if (state.enableTextures && mtrl.texture) {
    gl.bindTexture(gl.TEXTURE_2D, mtrl.texture);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, state.defaultTexture);
  }

  var uniforms = shader.uniforms;

  uniforms.uTexture.value = 0;

  uniforms.uDiffuse.value = mtrl.diffuseColor;
  uniforms.uAmbient.value = mtrl.ambientColor;
  uniforms.uSpecular.value = mtrl.specularColor;
  uniforms.uEmissive.value = mtrl.emissiveColor;
  uniforms.uShininess.value = mtrl.shininess;

  if (mtrl.flags & Mtrl.ENVIRONMENT) {
    uniforms.uEnvironment.value = 1;
  } else {
    uniforms.uEnvironment.value = 0;
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
      console.warn('Material image for ' + mtrl.name + ' is unknown');
      return Promise.reject();
    }

    mtrl._imageProm = data.fetchImage(imagePath).then(function (image) {
      mtrl.image = image;
    });
  }

  return mtrl._imageProm;
};

/*
 * Create texture and shader.
 */
Mtrl.prototype.createObjects = function (gl) {
  var mtrl = this;

  mtrl.shader.createObjects(gl);

  if (!mtrl._imageProm) {
    throw Error('Attempted to create material texture without fetching it first');
  }

  mtrl._imageProm.then(function () {
    mtrl.createTexture(gl);
  });
};