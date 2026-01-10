// Post-processing shader for WebGPU

struct VertexInput {
    @location(0) position: vec2f,
    @location(1) texCoord: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
}

struct PostProcessUniforms {
    blurEnabled: u32,
    bloomEnabled: u32,
    padding1: u32,
    padding2: u32,
}

@group(0) @binding(0) var screenTexture: texture_2d<f32>;
@group(0) @binding(1) var screenSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: PostProcessUniforms;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(input.position, 0.0, 1.0);
    output.texCoord = input.texCoord;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    var color = textureSample(screenTexture, screenSampler, input.texCoord);
    
    // Apply bloom effect to bright areas
    if (uniforms.bloomEnabled != 0u) {
        let texelSize = 1.0 / vec2f(textureDimensions(screenTexture));
        var bloomColor = vec4f(0.0);
        
        // Gaussian blur for bloom
        let bloomRadius = 8;
        var sampleCount = 0.0;
        let sigma = 2.0;
        
        for (var x = -bloomRadius; x <= bloomRadius; x++) {
            for (var y = -bloomRadius; y <= bloomRadius; y++) {
                let dist = f32(x * x + y * y);
                let weight = exp(-dist / (2.0 * sigma * sigma));
                let offset = vec2f(f32(x), f32(y)) * texelSize;
                let sampleColor = textureSample(screenTexture, screenSampler, input.texCoord + offset);
                
                // Extract bright areas (where emission is strong)
                let brightness = max(max(sampleColor.r, sampleColor.g), sampleColor.b);
                if (brightness > 1.5) {
                    bloomColor += sampleColor * weight;
                    sampleCount += weight;
                }
            }
        }
        
        if (sampleCount > 0.0) {
            bloomColor = bloomColor / sampleCount;
            // Add bloom on top of original color
            color = color + bloomColor * 0.3;
        }
        
        return color;
    }
    
    if (uniforms.blurEnabled != 0u) {
        // Enhanced box blur with larger kernel
        let texelSize = 1.0 / vec2f(textureDimensions(screenTexture));
        var blurColor = vec4f(0.0);
        let blurRadius = 5; // Increased from 2 to 5
        var sampleCount = 0.0;
        
        for (var x = -blurRadius; x <= blurRadius; x++) {
            for (var y = -blurRadius; y <= blurRadius; y++) {
                let offset = vec2f(f32(x), f32(y)) * texelSize * 2.0; // Increased offset multiplier
                blurColor += textureSample(screenTexture, screenSampler, input.texCoord + offset);
                sampleCount += 1.0;
            }
        }
        
        return blurColor / sampleCount;
    }

    // No post-processing, just pass through
    return textureSample(screenTexture, screenSampler, input.texCoord);
}
