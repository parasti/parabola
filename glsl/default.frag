precision highp float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;
#ifdef M_LIT
varying vec4 vLightColor;
varying vec3 vLightSpecular;
#endif

void main() {
#ifdef M_LIT
  gl_FragColor = texture2D(uTexture, vTexCoord) * vLightColor + vec4(vLightSpecular, 0.0);
#else
  gl_FragColor = texture2D(uTexture, vTexCoord);
#endif
}
