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
    padding1: u32,
    padding2: u32,
    padding3: u32,
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
    if (uniforms.blurEnabled != 0u) {
        // Enhanced box blur with larger kernel
        let texelSize = 1.0 / vec2f(textureDimensions(screenTexture));
        var color = vec4f(0.0);
        let blurRadius = 5; // Increased from 2 to 5
        var sampleCount = 0.0;
        
        for (var x = -blurRadius; x <= blurRadius; x++) {
            for (var y = -blurRadius; y <= blurRadius; y++) {
                let offset = vec2f(f32(x), f32(y)) * texelSize * 2.0; // Increased offset multiplier
                color += textureSample(screenTexture, screenSampler, input.texCoord + offset);
                sampleCount += 1.0;
            }
        }
        
        return color / sampleCount;
    } else {
        // No post-processing, just pass through
        return textureSample(screenTexture, screenSampler, input.texCoord);
    }
}
