uniform mat4 ProjectionMatrix;
uniform mat4 ViewMatrix;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
attribute mat4 aModelViewMatrix;

varying vec2 vTexCoord;

#ifdef M_LIT

//
// Lighting
//
const vec4 sceneAmbient = vec4(0.2, 0.2, 0.2, 1.0);

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
varying vec3 vLightSpecular;

vec4 calcLight(Light light, vec3 n) {
  // Assume directional lights (w = 0).
  vec3 VP = normalize((ViewMatrix * light.position).xyz);
  float nDotVP = max(0.0, dot(n, VP));
  vec4 color = uAmbient * light.ambient + nDotVP * uDiffuse * light.diffuse;
  return color;
}

vec4 calcSpecular(Light light, vec3 n) {
  // Assume directional lights (w = 0)
  if (uShininess <= 0.0) {
    return vec4(0.0);
  }
  vec3 VP = normalize((ViewMatrix * light.position).xyz);
  float nDotVP = dot(n, VP);
  if (nDotVP <= 0.0) {
    return vec4(0.0);
  }
  // OpenGL 1.5 default: GL_LIGHT_MODEL_LOCAL_VIEWER = GL_FALSE -> viewer = (0, 0, 1)
  vec3 h = normalize(VP + vec3(0.0, 0.0, 1.0));
  float nDotH = dot(n, h);
  if (nDotH <= 0.0) {
    return vec4(0.0);
  }
  vec4 specular = pow(nDotH, uShininess) * uSpecular * light.specular;
  return specular;
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
  vec3 eyeNormal = normalize((aModelViewMatrix * vec4(aNormal, 0.0)).xyz);
  vec4 eyePos = aModelViewMatrix * vec4(aPosition, 1.0);

#ifdef M_LIT
  vec4 lightColor = uEmissive + uAmbient * sceneAmbient + calcLight(Light0, eyeNormal) + calcLight(Light1, eyeNormal);
  vec4 lightSpecular = calcSpecular(Light0, eyeNormal) + calcSpecular(Light1, eyeNormal);

  vLightColor = clamp(vec4(lightColor.rgb, uDiffuse.a), 0.0, 1.0);
  vLightSpecular = clamp(lightSpecular.rgb, 0.0, 1.0);
#endif

#if defined(M_ENVIRONMENT)
  vTexCoord = genSphereMap(eyePos.xyz, eyeNormal);
#else
  vTexCoord = aTexCoord;
#endif

  gl_Position = ProjectionMatrix * eyePos;
}
