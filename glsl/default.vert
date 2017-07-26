uniform mat4 uPersp;
uniform mat4 uView;
uniform mat4 uModel;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

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

vec2 calcSphereMap(vec3 n) {
  vec3 u = (uView * uModel * vec4(aPosition, 1.0)).xyz;
  vec3 r = u - 2.0 * n * (n * u);
  r.z += 1.0;
  float m = 2.0 * length(r);
  return vec2(r.x / m + 0.5, r.y / m + 0.5);
}

void main() {
  // TODO eye coordinates
  vec4 eyeNormal = normalize(uModel * vec4(aNormal, 0.0));

  vec4 lightColor =
    uEmissive +
    uAmbient * Light_GlobalAmbient +
    calcLight(Light0, eyeNormal) +
    calcLight(Light1, eyeNormal);

  vLightColor = clamp(vec4(lightColor.rgb, uDiffuse.a), 0.0, 1.0);
  //vLightColor.rgb = vLightColor.rgb * vLightColor.a; // Premultiply.

  if (uEnvironment)
    vTexCoord = calcSphereMap(eyeNormal.xyz);
  else
    vTexCoord = aTexCoord;

  gl_Position = uPersp * uView * uModel * vec4(aPosition, 1.0);
}
