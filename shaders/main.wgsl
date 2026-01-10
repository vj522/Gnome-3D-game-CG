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
    emissionFactor: vec3f,
    hasBaseTexture: u32,
    padding1: u32,
    padding2: u32,
}

struct LightUniforms {
    direction: vec3f,
    padding1: f32,
    color: vec3f,
    padding2: f32,
    pickupLightPos: vec3f,
    pickupIntensity: f32,
    pickupColor: vec3f,
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
    
    // ===== STANDARD DIRECTIONAL LIGHTING =====
    let lightDir = normalize(-light.direction);
    
    // Ambient light (base illumination)
    let ambient = 0.3 * light.color;
    
    // Diffuse light from directional light
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * light.color;
    
    // Specular light
    let viewDir = normalize(camera.cameraPosition - input.worldPosition);
    let reflectDir = reflect(-lightDir, normal);
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    let specular = 0.5 * spec * light.color;
    
    // Combine standard lighting
    var result = (ambient + diffuse + specular) * baseColor.rgb;
    
    // ===== PICKUP POINT LIGHT (ADDITIONAL) =====
    if (light.pickupIntensity > 0.01) {
        let lightToPixel = light.pickupLightPos - input.worldPosition;
        let distance = length(lightToPixel);
        let pickupDir = normalize(lightToPixel);
        
        // Attenuation based on distance
        let attenuation = 1.0 / (1.0 + distance * distance * 0.5);
        
        // Screen space falloff - stronger in center, weaker at edges (vignette effect)
        let screenPos = input.clipPosition.xy / vec2f(1280.0, 720.0); // Normalized screen coordinates
        let screenCenter = vec2f(0.5, 0.5);
        let screenDist = length(screenPos - screenCenter);
        // Wider reach (0.0 -> 1.05) and stronger center boost
        let screenFalloff = (1.0 - smoothstep(0.0, 1.05, screenDist)) * 3.0;
        
        // Diffuse from pickup light
        let pickupDiff = max(dot(normal, pickupDir), 0.0);
        let pickupDiffuse = pickupDiff * light.pickupColor * attenuation * light.pickupIntensity * screenFalloff;
        
        // Specular from pickup light
        let pickupReflect = reflect(-pickupDir, normal);
        let pickupSpec = pow(max(dot(viewDir, pickupReflect), 0.0), 32.0);
        let pickupSpecular = 0.3 * pickupSpec * light.pickupColor * attenuation * light.pickupIntensity * screenFalloff;
        
        // Add pickup lighting to result
        result = result + (pickupDiffuse + pickupSpecular) * baseColor.rgb;
    }
    
    // Add emission as pure additive (creates glow effect without washing out)
    result = result + material.emissionFactor;
    
    // Apply distance fog - less intense
    if (camera.fogDensity > 0.001) {
        let distance_fog = length(input.worldPosition - camera.cameraPosition);
        let fogFactor = exp(-camera.fogDensity * distance_fog * 0.5);  // 0.5 za manj intenzivno meglo
        result = mix(camera.fogColor, result, fogFactor);
    }
    
    return vec4f(result, baseColor.a);
}
