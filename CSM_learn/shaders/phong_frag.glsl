precision mediump float;

// Uniforms
uniform vec3 uLightDirection; // World space light direction (normalized, points TO the light source)
uniform vec3 uAmbientColor;   // Ambient light color in the scene
uniform vec3 uDiffuseColor;   // Material diffuse color
uniform vec3 uSpecularColor;  // Material specular color
uniform float uShininess;     // Material shininess exponent
uniform vec3 uLightColor;     // Light source color (intensity)

// Varyings from Vertex Shader
in vec3 vWorldNormal;
in vec3 vWorldPosition; // World position of the fragment
in vec3 vViewDir;       // Normalized world space view direction (from fragment to camera)

// Output
out vec4 fragColor;

void main( )
{
    // Normalize interpolated vectors
  vec3 N = normalize( vWorldNormal );
  vec3 V = normalize( vViewDir );
  vec3 L = normalize( uLightDirection ); // Direction TO the light source

    // Ambient component
    // Modulate scene ambient light by material's diffuse color
  vec3 ambient = uAmbientColor * uDiffuseColor;

    // Diffuse component (Lambertian)
  float NdotL = max( dot( N, L ), 0.0f ); // Light intensity falls off with angle
  vec3 diffuse = uLightColor * uDiffuseColor * NdotL;

    // Specular component (Blinn-Phong)
  vec3 H = normalize( L + V ); // Halfway vector
  float NdotH = max( dot( N, H ), 0.0f );
  float specPower = pow( NdotH, uShininess );
  vec3 specular = uLightColor * uSpecularColor * specPower;

    // Combine components
  vec3 finalColor = ambient + diffuse + specular;

  fragColor = vec4( finalColor, 1.0f );
}