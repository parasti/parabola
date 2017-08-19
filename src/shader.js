'use strict';

var ShaderGraph = require('@parasti/shadergraph')(fetchSnippet, { globalUniforms: true });
var Mtrl = require('./mtrl.js');

/*
 * Build shaders and uniforms for the given material.
 */
var Shader = module.exports = function (mtrl) {
  var shaderFlags = shaderFlagsFromMtrl(mtrl);

  var material = ShaderGraph.material();

  var frag = material.fragment;
  var vert = material.vertex;

  /*
   * Build a fragment shader.
   */

  if (shaderFlags & Shader.LIT) {
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

  if (shaderFlags & Shader.ALPHA_TEST) {
    var alphaFunc = alphaFuncSnippets[alphaFuncFromShaderFlags(shaderFlags)];

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

  vert
    .pipe('vert.getPosition')
    .pipe('eyeVertex')
    .pipe('perspVertex')
    .pipe('vert.setPosition');

  vert.isolate();

  if (shaderFlags & Shader.ENVIRONMENT) {
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
    vertexShader: program.vertexShader,
    fragmentShader: program.fragmentShader,
    uniforms: program.uniforms
  }
}

/*
 * Gather shader flags from a SOL material.
 */
function shaderFlagsFromMtrl (mtrl) {
  var flags = 0;

  if (mtrl.fl & Mtrl.LIT) {
    flags |= Shader.LIT;
  }

  if (mtrl.fl & Mtrl.ALPHA_TEST) {
    flags |= shaderFlagsFromAlphaFunc(mtrl.alphaFunc);
  }

  if (mtrl.fl & Mtrl.ENVIRONMENT) {
    flags |= Shader.ENVIRONMENT;
  }

  return flags;
}

/*
 * Features that a shader implements.
 */
Shader.LIT           = (1 << 0);
Shader.ENVIRONMENT   = (1 << 1);
Shader.ALPHA_TEST    = (7 << 2); // 3 bits

/*
 * There are 7 alpha test functions. Function index is encoded in shader flags.
 * This is done to reduce hassle, but the act of doing so increases the hassle. FML.
 */

function alphaFuncFromShaderFlags (flags) {
  return (flags >> 2) & 0x7;
}

function shaderFlagsFromAlphaFunc (index) {
  return (index & 0x7) << 2;
}

/*
 * Alpha funcs (share/solid_base.c)
 */
var alphaFuncSnippets = [
  undefined, // 'testAlways' = no alpha test
  'testEqual',
  'testGequal',
  'testGreater',
  'testLequal',
  'testLess',
  'testNever',
  'testNotEqual',
];

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
  multiply: binaryOp('a * b', 'vec4'),

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

  testEqual:    binaryOp('a == b', 'float', 'bool'),
  testGequal:   binaryOp('a >= b', 'float', 'bool'),
  testGreater:  binaryOp('a > b',  'float', 'bool'),
  testLequal:   binaryOp('a <= b', 'float', 'bool'),
  testLess:     binaryOp('a < b',  'float', 'bool'),
  testNever:    binaryOp('false',  'float', 'bool'),
  testNotEqual: binaryOp('a != b', 'float', 'bool'),
};

/*
 * Make a snippet for a binary operation. MathBox-inspired.
 */
function binaryOp (expr, valType, retType) {
  retType = retType || valType;
  return `${retType} binaryOp(${valType} a, ${valType} b) { return ${expr}; }`;
}