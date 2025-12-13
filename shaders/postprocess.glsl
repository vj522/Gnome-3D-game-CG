#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uScreenTexture;
uniform bool uBlurEnabled;

// Simple box blur
void main() {
    if (!uBlurEnabled) {
        // No blur, just pass through
        fragColor = texture(uScreenTexture, vTexCoord);
        return;
    }
    
    // Blur effect - sample surrounding pixels
    vec2 texelSize = 1.0 / vec2(textureSize(uScreenTexture, 0));
    vec3 result = vec3(0.0);
    
    // 5x5 blur kernel
    float weight = 0.0;
    for(int x = -2; x <= 2; x++) {
        for(int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize * 2.0;
            result += texture(uScreenTexture, vTexCoord + offset).rgb;
            weight += 1.0;
        }
    }
    
    fragColor = vec4(result / weight, 1.0);
}
