#version 300 es
precision highp float;

// Inputs from vertex shader
in vec3 vPosition;
in vec3 vNormal;
in vec2 vTexCoord;

// Uniforms
uniform vec3 uCameraPosition;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec4 uBaseColorFactor;
uniform sampler2D uBaseTexture;
uniform bool uHasBaseTexture;

// Output
out vec4 fragColor;

void main() {
    // Get base color
    vec4 baseColor = uBaseColorFactor;
    if (uHasBaseTexture) {
        baseColor *= texture(uBaseTexture, vTexCoord);
    }
    
    // Normalize normal
    vec3 normal = normalize(vNormal);
    
    // Calculate lighting
    vec3 lightDir = normalize(-uLightDirection);
    
    // Ambient light
    vec3 ambient = 0.3 * uLightColor;
    
    // Diffuse light
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * uLightColor;
    
    // Specular light (simple)
    vec3 viewDir = normalize(uCameraPosition - vPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = 0.5 * spec * uLightColor;
    
    // Combine lighting
    vec3 result = (ambient + diffuse + specular) * baseColor.rgb;
    
    // Apply fog (distance-based)
    float distance = length(uCameraPosition - vPosition);
    float fogFactor = exp(-0.02 * distance);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    vec3 fogColor = vec3(0.5, 0.6, 0.7);
    result = mix(fogColor, result, fogFactor);
    
    fragColor = vec4(result, baseColor.a);
}
