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

  this.id = 'Mtrl:' + _materialIndex++;
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

/**
 * A word on why there are more flags than there are in Neverball:
 *
 * In Neverball, a frame is rendered via a series of hard-coded
 * rendering passes. The code sets up GL state for some part of
 * the scene and renders that part, then another, and so on.
 * When that part is from a SOL file, the GL state is controlled
 * by the materials of that SOL file - but not entirely. A number
 * of state changes only exist in the code, and are impossible
 * via material flags.
 *
 * Given that our frame rendering is (by necessity) very different
 * from that of Neverball, a natural opportunity arises to turn these
 * special-cased state changes into general-purpose material flags.
 *
 * These extra flags are indicated by a leading underscore.
 */

/**
 * Enable depth testing.
 *
 * In Neverball, depth testing is controlled by a sol_draw parameter.
 */
Mtrl._DEPTH_TEST = (1 << 14);
/**
 * Enable depth writing.
 *
 * In Neverball, depth writes are controlled by a sol_draw parameter.
 */
Mtrl._DEPTH_WRITE = (1 << 13);
/**
 * Enable blending.
 *
 * In Neverball, blending is always enabled.
 */
Mtrl._BLEND = (1 << 12);
/**
 * Shader flag. Does nothing during rendering.
 */
Mtrl.LIT = (1 << 11);
/**
 * TODO
 */
Mtrl.PARTICLE = (1 << 10);
/**
 * TODO
 */
Mtrl.ALPHA_TEST = (1 << 9);
/**
 * TODO
 * Approximately:
 * 1) render material into stencil buffer
 * 2) render scene with stencil buffer enabled
 * 3) render material normally
 * 4) render scene normally
 */
Mtrl.REFLECTIVE = (1 << 8);
/**
 * This flag (or the absence of it) is decomposed into Mtrl._DEPTH_WRITE and Mtrl._BLEND.
 */
Mtrl.TRANSPARENT = (1 << 7);
/**
 * TODO
 */
Mtrl.SHADOWED = (1 << 6);
/**
 * Enable polygon offset.
 */
Mtrl.DECAL = (1 << 5);
/**
 * Shader flag. Does nothing during rendering.
 */
Mtrl.ENVIRONMENT = (1 << 4);
/**
 * Disable back face culling.
 */
Mtrl.TWO_SIDED = (1 << 3);
/**
 * Enable additive blending.
 */
Mtrl.ADDITIVE = (1 << 2);
/**
 * Texture parameter. Does nothing during rendering.
 */
Mtrl.CLAMP_S = (1 << 1);
/**
 * Texture parameter. Does nothing during rendering.
 */
Mtrl.CLAMP_T = (1 << 0);

/**
 * Break Neverball mtrl flags down into a finer set of flags
 * that map one-to-one with GL state changes.
 */
function decomposeFlags (fl) {
  var flags = fl | Mtrl._DEPTH_TEST;

  if (flags & Mtrl.TRANSPARENT) {
    flags |= Mtrl._BLEND;
    flags &= ~Mtrl._DEPTH_WRITE;
  } else {
    flags &= ~Mtrl._BLEND;
    flags |= Mtrl._DEPTH_WRITE;
  }

  return flags;
}

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
