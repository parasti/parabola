precision highp float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;
#ifdef M_LIT
varying vec4 vLightColor;
#endif

void main() {
#ifdef M_LIT
  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor;
#else
  gl_FragColor = texture2D(uTexture, vTexCoord);
#endif
}
