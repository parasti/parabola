uniform mat4 ProjectionMatrix;
uniform mat4 ModelViewMatrix;
uniform mat3 NormalMatrix;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
attribute mat4 aModelViewMatrix;

varying vec2 vTexCoord;

#ifdef M_LIT

//
// Lighting
//
const float Light_GlobalAmbient = 0.2;

struct Light {
  vec4 position;
  vec4 diffuse;
  vec4 ambient;
  vec4 specular;
};

const Light Light0 = Light(
  vec4(-8.0, +32.0, -8.0, 0.0),
  vec4(1.0, 0.8, 0.8, 1.0),
  vec4(0.7, 0.7, 0.7, 1.0),
  vec4(1.0, 0.8, 0.8, 1.0)
);

const Light Light1 = Light(
  vec4(+8.0, +32.0, +8.0, 0.0),
  vec4(0.8, 1.0, 0.8, 1.0),
  vec4(0.7, 0.7, 0.7, 1.0),
  vec4(0.8, 1.0, 0.8, 1.0)
);

uniform vec4 uDiffuse;
uniform vec4 uAmbient;
uniform vec4 uSpecular;
uniform vec4 uEmissive;
uniform float uShininess;
uniform bool uEnvironment;

varying vec4 vLightColor;

vec4 calcLight(Light light, vec4 eyeNormal) {
  // Assume directional lights.
  // TODO specular
  return
    uAmbient * light.ambient +
    max(0.0, dot(eyeNormal, normalize(light.position))) * uDiffuse * light.diffuse;
}
#endif // M_LIT

#ifdef M_ENVIRONMENT
vec2 genSphereMap(vec3 p, vec3 n) {
  vec3 u = normalize(p);
  vec3 r = reflect(u, n);
  r.z += 1.0;
  float m = 2.0 * length(r);
  return vec2(r.x / m + 0.5, r.y / m + 0.5);
}
#endif

void main() {
  vec3 eyeNormal = normalize(mat3(aModelViewMatrix) * aNormal);
  vec4 eyePos = aModelViewMatrix * vec4(aPosition, 1.0);

#ifdef M_LIT
  vec4 lightColor =
    uEmissive +
    uAmbient * Light_GlobalAmbient +
    calcLight(Light0, vec4(eyeNormal, 1.0)) +
    calcLight(Light1, vec4(eyeNormal, 1.0));

  vLightColor = clamp(vec4(lightColor.rgb, uDiffuse.a), 0.0, 1.0);
  //vLightColor.rgb = vLightColor.rgb * vLightColor.a; // Premultiply.
#endif

#if defined(M_ENVIRONMENT)
  vTexCoord = genSphereMap(eyePos.xyz, eyeNormal);
#else
  vTexCoord = aTexCoord;
#endif

  gl_Position = ProjectionMatrix * eyePos;
}
