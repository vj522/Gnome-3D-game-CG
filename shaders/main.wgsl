// Main shader for WebGPU rendering with lighting

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texCoord: vec2f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) worldPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) texCoord: vec2f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    cameraPosition: vec3f,
    padding1: f32, // Alignment padding
    fogColor: vec3f,
    padding2: f32,
    fogDensity: f32,
    padding3: f32,
    padding4: f32,
    padding5: f32,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat4x4f, // 4x4 for alignment (only use 3x3 portion)
}

struct MaterialUniforms {
    baseColorFactor: vec4f,
    hasBaseTexture: u32,
    padding1: u32,
    padding2: u32,
    padding3: u32,
}

struct LightUniforms {
    direction: vec3f,
    padding1: f32,
    color: vec3f,
    padding2: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> light: LightUniforms;

@group(1) @binding(0) var<uniform> model: ModelUniforms;

@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var baseTexture: texture_2d<f32>;
@group(2) @binding(2) var baseSampler: sampler;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Transform position to world space
    let worldPos = model.modelMatrix * vec4f(input.position, 1.0);
    output.worldPosition = worldPos.xyz;
    
    // Transform normal to world space (use 3x3 portion of normalMatrix)
    let normal4 = model.normalMatrix * vec4f(input.normal, 0.0);
    output.normal = normalize(normal4.xyz);
    
    // Pass texture coordinates
    output.texCoord = input.texCoord;
    
    // Final position in clip space
    // WebGPU NDC Y-axis is top-to-bottom, so flip Y coordinate
    var clipPos = camera.projectionMatrix * camera.viewMatrix * worldPos;
    clipPos.y = -clipPos.y;
    output.clipPosition = clipPos;
    
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Get base color
    var baseColor = material.baseColorFactor;
    if (material.hasBaseTexture != 0u) {
        baseColor *= textureSample(baseTexture, baseSampler, input.texCoord);
    }
    
    // Alpha test - discard fully transparent pixels
    if (baseColor.a < 0.01) {
        discard;
    }
    
    // Normalize normal
    let normal = normalize(input.normal);
    
    // Calculate lighting
    let lightDir = normalize(-light.direction);
    
    // Ambient light
    let ambient = 0.3 * light.color;
    
    // Diffuse light
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * light.color;
    
    // Specular light
    let viewDir = normalize(camera.cameraPosition - input.worldPosition);
    let reflectDir = reflect(-lightDir, normal);
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    let specular = 0.5 * spec * light.color;
    
    // Combine lighting
    var result = (ambient + diffuse + specular) * baseColor.rgb;
    
    // Apply distance fog
    if (camera.fogDensity > 0.001) {
        let distance = length(input.worldPosition - camera.cameraPosition);
        let fogFactor = exp(-camera.fogDensity * distance);
        result = mix(camera.fogColor, result, fogFactor);
    }
    
    // Apply ground fog at boundaries (only near ground)
    if (camera.fogDensity > 0.001) {
        let boundaryDist = max(abs(input.worldPosition.x) - 5.0, abs(input.worldPosition.z) - 5.0);
        if (boundaryDist > 0.0) {
            let groundFogColor = vec3f(0.9, 0.95, 1.0);  // Svetlo modro-bela megla
            let groundFogFactor = clamp(boundaryDist / 30.0, 0.0, 1.0);
            let heightFactor = clamp((60.0 - input.worldPosition.y) / 60.0, 0.0, 2.0);
            result = mix(result, groundFogColor, groundFogFactor * heightFactor * 1.0);
        }
    }
    
    return vec4f(result, baseColor.a);
}
