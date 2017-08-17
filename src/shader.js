'use strict';

var ShaderGraph = require('@parasti/shadergraph')(fetchSnippet, { globalUniforms: true });
var Mtrl = require('./mtrl.js');

/*
 * Build shaders and uniforms for the given material flags.
 */
module.exports = function (mtrl) {
  var material = ShaderGraph.material();

  var frag = material.fragment;
  var vert = material.vertex;

  // Material flags that uniquely identify this shader.

  var shaderFlags = 0;

  /*
   * Build a fragment shader.
   */

  // T&L

  if (mtrl.fl & Mtrl.LIT) {
    shaderFlags |= Mtrl.LIT;

    frag
      .fan()
        .pipe('frag.getTexCoord')
        .pipe('sampleTexture')
      .next()
        .pipe('frag.getLightColor')
      .end()
      .pipe('multiply');
  } else {
    frag
      .pipe('frag.getTexCoord')
      .pipe('sampleTexture');
  }

  // Alpha test

  if (mtrl.fl & Mtrl.ALPHA_TEST) {
    var alphaFunc;

    // share/solid_base.c
    switch (mtrl.alphaFunc) {
      // 0 is always = no alpha test.
      case 1:
        shaderFlags |= Mtrl.ALPHA_TEST_EQUAL;
        alphaFunc = 'frag.alphaTestEqual';
        break;
      case 2:
        shaderFlags |= Mtrl.ALPHA_TEST_GEQUAL;
        alphaFunc = 'frag.alphaTestGequal';
        break;
      case 3:
        shaderFlags |= Mtrl.ALPHA_TEST_GREATER;
        alphaFunc = 'frag.alphaTestGreater';
        break;
      case 4:
        shaderFlags |= Mtrl.ALPHA_TEST_LEQUAL;
        alphaFunc = 'frag.alphaTestLequal';
        break;
      case 5:
        shaderFlags |= Mtrl.ALPHA_TEST_LESS;
        alphaFunc = 'frag.alphaTestLess';
        break;
      case 6:
        shaderFlags |= Mtrl.ALPHA_TEST_NEVER;
        alphaFunc = 'frag.alphaTestNever';
        break;
      case 7:
        shaderFlags |= Mtrl.ALPHA_TEST_NOTEQUAL;
        alphaFunc = 'frag.alphaTestNotEqual';
        break;
    }

    if (alphaFunc) {
      frag
        .require(alphaFunc)
        .pipe('frag.alphaTest');
    }
  }

  frag.pipe('frag.setFragColor');

  /*
   * Build a vertex shader.
   */

  // Position.

  vert
    .pipe('vert.getPosition')
    .pipe('eyeVertex')
    .pipe('perspVertex')
    .pipe('vert.setPosition');

  // Texture coords. Pass thru or generate sphere map coords.

  vert.isolate();

  if (mtrl.fl & Mtrl.ENVIRONMENT) {
    shaderFlags |= Mtrl.ENVIRONMENT;

    vert
      .fan()
        .pipe('vert.getPosition')
        .pipe('eyeVertex')
      .next()
        .pipe('vert.getNormal')
        .pipe('eyeNormal')
      .end()
      .pipe('genSphereMap')
      .pipe('vert.setTexCoord');
  } else {
    vert
      .pipe('vert.getTexCoord')
      .pipe('vert.setTexCoord');
  }

  vert.end();

  var program = material.link();

  return {
    shaderFlags: shaderFlags,
    vertexSource: program.vertexShader,
    fragmentSource: program.fragmentShader,
    uniforms: program.uniforms
  }
}

/*
 * Snippet library.
 */
function fetchSnippet (key) {
  if (/^vert\./.test(key)) {
    return vertSnippets[key.slice(5)];
  } else if (/^frag\./.test(key)) {
    return fragSnippets[key.slice(5)];
  } else {
    return glslSnippets[key];
  }
}

var fragSnippets = {
  getTexCoord: `
  varying vec2 vTexCoord;
  vec2 getTexCoord() { return vTexCoord; }`,
  
  getLightColor: `
  varying vec4 vLightColor;
  vec4 getLightColor() { return vLightColor; }`,
  
  alphaTestGequal: `
  bool alphaTestGequal(float alpha, float ref) { return alpha >= ref; }`,
  // TODO alpha test funcs.

  alphaTest: `
  uniform float AlphaRef;

  bool alphaFunc(float alpha, float ref);
  vec4 alphaTest(vec4 color) {
    if (!alphaFunc(color.a, ref))
      discard;
    return color;
  }`,
  
  setFragColor: `
  void setFragColor(vec4 color) { gl_FragColor = color; }`,
};

var vertSnippets = {
  getPosition: `
  attribute vec3 aPosition;
  vec4 getPosition() { return vec4(aPosition, 1.0); }`,

  getNormal: `
  attribute vec3 aNormal;
  vec3 getNormal() { return aNormal; }`,
  
  getTexCoord: `
  attribute vec2 aTexCoord;
  vec2 getTexCoord() { return aTexCoord; }`,

  setPosition: `
  void setPosition(vec4 v) { gl_Position = v; }
  `,
  
  setTexCoord: `
  varying vec2 vTexCoord;
  void setTexCoord(vec2 uv) { vTexCoord = uv; }`,
  
  setLightColor: `
  varying vec4 vLightColor;
  void setLightColor(vec4 color) { vLightColor = color; }`,
};

var glslSnippets = {
  multiply: `
  vec4 multiply(vec4 a, vec4 b) { return a * b; }`,

  sampleTexture: `
  uniform sampler2D Texture;
  vec4 sampleTexture(vec2 uv) { return texture2D(Texture, uv); }`,

  genSphereMap: `
  vec2 genSphereMap(vec3 u, vec3 n) {
    vec3 r = u - 2.0 * n * (n * u);
    r.z += 1.0;
    float m = 2.0 * length(r);
    return vec2(r.x / m + 0.5, r.y / m + 0.5);
  }
  vec2 genSphereMap(vec4 u, vec3 n) {
    return genSphereMap(vec3(u), n);
  }`,

  eyeVertex: `
  uniform mat4 ModelViewMatrix;
  vec4 eyeVertex(vec4 v) { return ModelViewMatrix * v; }`,

  eyeNormal: `
  uniform mat3 NormalMatrix;
  vec3 eyeNormal(vec3 n) { return NormalMatrix * n; }`,

  perspVertex: `
  uniform mat4 PerspMatrix;
  vec4 perspVertex(vec4 v) { return PerspMatrix * v; }`,
};
