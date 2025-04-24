precision mediump float;

// Uniforms from Three.js (Provided automatically, no need to declare)
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform mat3 normalMatrix;
// uniform mat4 modelMatrix;
// uniform vec3 cameraPosition;

// Attributes from Geometry (Provided automatically, no need to declare)
// in vec3 position;
// in vec3 normal;

// Varyings to Fragment Shader
out vec3 vWorldNormal;
out vec3 vWorldPosition;
out vec3 vViewDir; // World space view direction

void main( )
{
    // Calculate world position
  vec4 worldPosition4 = modelMatrix * vec4( position, 1.0f );
  vWorldPosition = worldPosition4.xyz;

    // Calculate world normal
    // Use inverse transpose of model matrix for correct normal transformation
    // Note: normalMatrix is view-space normal matrix. For world normal, use modelMatrix.
  mat3 worldNormalMatrix = mat3( transpose( inverse( modelMatrix ) ) );
  vWorldNormal = normalize( worldNormalMatrix * normal );

    // Calculate world view direction (from surface point to camera)
  vViewDir = normalize( cameraPosition - vWorldPosition );

    // Calculate final position
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0f );
}