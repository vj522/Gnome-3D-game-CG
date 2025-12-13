#version 300 es

// Vertex attributes
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

// Uniforms
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

// Outputs to fragment shader
out vec3 vPosition;
out vec3 vNormal;
out vec2 vTexCoord;

void main() {
    // Transform position to world space
    vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
    vPosition = worldPosition.xyz;
    
    // Transform normal to world space
    vNormal = normalize(uNormalMatrix * aNormal);
    
    // Pass texture coordinates
    vTexCoord = aTexCoord;
    
    // Final position in clip space
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
