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
    pointLightPos: vec3f,    // Torch position
    pointLightRadius: f32,   // Light falloff radius
    pointLightColor: vec3f,  // Torch light color
    padding3: f32,
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
    
    // Combine ambient + directional lighting
    var result = (ambient + diffuse + specular) * baseColor.rgb;
    
    // Add point light from torch
    let toPointLight = light.pointLightPos - input.worldPosition;
    let distToPointLight = length(toPointLight);
    
    // Only apply if within radius
    if (distToPointLight < light.pointLightRadius) {
        let pointLightDir = normalize(toPointLight);
        let pointDiff = max(dot(normal, pointLightDir), 0.0);
        
        // Attenuation: linearno slabljenje namesto kvadratnega
        var attenuation = 1.0 - (distToPointLight / light.pointLightRadius);
        
        // Diffuse light od torcha
        let pointDiffuse = pointDiff * light.pointLightColor * attenuation;
        result += pointDiffuse * baseColor.rgb;
        
        // Tudi ambient svetloba od torcha (vidna tudi na stenah ki niso obrnjene k torchu)
        let pointAmbient = 0.3 * light.pointLightColor * attenuation;
        result += pointAmbient * baseColor.rgb;
    }
    
    // No fog
    
    return vec4f(result, baseColor.a);
}
