precision highp float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;
varying vec4 vLightColor;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor;
}
