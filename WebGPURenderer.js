import { mat4, mat3 } from './lib/glm.js';

export class WebGPURenderer {
    constructor(device, context, canvas, mainShaderModule, postProcessShaderModule) {
        this.device = device;
        this.context = context;
        this.canvas = canvas;
        
        // Configure context
        this.preferredFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.preferredFormat,
            alphaMode: 'opaque',
        });
        
        // Caches
        this.bufferCache = new Map();
        this.textureCache = new Map();
        this.bindGroupCache = new Map();
        
        // Create pipelines
        this.createMainPipeline(mainShaderModule);
        this.createPostProcessPipeline(postProcessShaderModule);
        
        // Create uniform buffers
        this.createUniformBuffers();
        
        // Setup post-processing
        this.setupPostProcessing();
    }
    
    createMainPipeline(shaderModule) {
        // Create bind group layouts
        this.cameraBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });
        
        this.modelBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }
            ]
        });
        
        this.materialBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                }
            ]
        });
        
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                this.cameraBindGroupLayout,
                this.modelBindGroupLayout,
                this.materialBindGroupLayout
            ]
        });
        
        // Create render pipeline
        this.mainPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        arrayStride: 12, // 3 floats for position
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    },
                    {
                        arrayStride: 12, // 3 floats for normal
                        attributes: [{
                            shaderLocation: 1,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    },
                    {
                        arrayStride: 8, // 2 floats for texCoord
                        attributes: [{
                            shaderLocation: 2,
                            offset: 0,
                            format: 'float32x2'
                        }]
                    }
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: this.preferredFormat,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });
    }
    
    createPostProcessPipeline(shaderModule) {
        this.postProcessBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });
        
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.postProcessBindGroupLayout]
        });
        
        this.postProcessPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 16, // 4 floats (2 for position, 2 for texCoord)
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2'
                        },
                        {
                            shaderLocation: 1,
                            offset: 8,
                            format: 'float32x2'
                        }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: this.preferredFormat
                }]
            },
            primitive: {
                topology: 'triangle-strip'
            }
        });
    }
    
    createUniformBuffers() {
        // Camera uniform buffer (mat4 + mat4 + vec3 + padding = 144 bytes)
        this.cameraUniformBuffer = this.device.createBuffer({
            size: 144,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Light uniform buffer (vec3 + padding + vec3 + padding = 32 bytes)
        this.lightUniformBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Create camera bind group
        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.cameraBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.cameraUniformBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.lightUniformBuffer }
                }
            ]
        });
        
        // Default sampler
        this.defaultSampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat'
        });
    }
    
    setupPostProcessing() {
        // Create render target texture
        this.renderTexture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            format: this.preferredFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        
        this.renderTextureView = this.renderTexture.createView();
        
        // Create depth texture
        this.depthTexture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        this.depthTextureView = this.depthTexture.createView();
        
        // Create fullscreen quad
        const quadVertices = new Float32Array([
            -1, -1,  0, 0,
             1, -1,  1, 0,
            -1,  1,  0, 1,
             1,  1,  1, 1
        ]);
        
        this.quadBuffer = this.device.createBuffer({
            size: quadVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.quadBuffer.getMappedRange()).set(quadVertices);
        this.quadBuffer.unmap();
        
        // Post-process uniform buffer
        this.postProcessUniformBuffer = this.device.createBuffer({
            size: 16, // 4 u32s with padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Create post-process bind group
        this.postProcessBindGroup = this.device.createBindGroup({
            layout: this.postProcessBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.renderTextureView
                },
                {
                    binding: 1,
                    resource: this.defaultSampler
                },
                {
                    binding: 2,
                    resource: { buffer: this.postProcessUniformBuffer }
                }
            ]
        });
    }
    
    resizePostProcessing(width, height) {
        // Recreate render texture
        this.renderTexture.destroy();
        this.renderTexture = this.device.createTexture({
            size: { width, height },
            format: this.preferredFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.renderTextureView = this.renderTexture.createView();
        
        // Recreate depth texture
        this.depthTexture.destroy();
        this.depthTexture = this.device.createTexture({
            size: { width, height },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();
        
        // Recreate post-process bind group
        this.postProcessBindGroup = this.device.createBindGroup({
            layout: this.postProcessBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.renderTextureView
                },
                {
                    binding: 1,
                    resource: this.defaultSampler
                },
                {
                    binding: 2,
                    resource: { buffer: this.postProcessUniformBuffer }
                }
            ]
        });
    }
    
    createBufferFromData(data, usage) {
        // Ensure size is aligned to 4 bytes
        const alignedSize = Math.ceil(data.byteLength / 4) * 4;
        
        const buffer = this.device.createBuffer({
            size: alignedSize,
            usage: usage,
            mappedAtCreation: true
        });
        
        if (data instanceof Float32Array) {
            new Float32Array(buffer.getMappedRange()).set(data);
        } else if (data instanceof Uint16Array) {
            new Uint16Array(buffer.getMappedRange()).set(data);
        } else if (data instanceof Uint32Array) {
            new Uint32Array(buffer.getMappedRange()).set(data);
        }
        
        buffer.unmap();
        return buffer;
    }
    
    async createTexture(image) {
        // Create texture
        const texture = this.device.createTexture({
            size: {
                width: image.width,
                height: image.height
            },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            mipLevelCount: 1 // Disable mipmaps for now to simplify
        });
        
        // Create a canvas to get image data
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        
        // Write data to texture
        this.device.queue.writeTexture(
            { texture: texture },
            imageData.data,
            {
                offset: 0,
                bytesPerRow: image.width * 4,
                rowsPerImage: image.height
            },
            {
                width: image.width,
                height: image.height,
                depthOrArrayLayers: 1
            }
        );
        
        return texture;
    }
    
    generateMipmaps(texture) {
        const mipLevelCount = texture.mipLevelCount;
        
        if (mipLevelCount <= 1) return;
        
        const commandEncoder = this.device.createCommandEncoder();
        
        for (let i = 1; i < mipLevelCount; i++) {
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: texture.createView({
                        baseMipLevel: i,
                        mipLevelCount: 1
                    }),
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });
            
            passEncoder.end();
        }
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    getOrCreateBuffers(primitive) {
        let buffers = this.bufferCache.get(primitive);
        
        if (!buffers) {
            const mesh = primitive.mesh;
            buffers = {};
            
            if (mesh.positions && mesh.positions.length > 0) {
                buffers.position = this.createBufferFromData(
                    new Float32Array(mesh.positions),
                    GPUBufferUsage.VERTEX
                );
            }
            
            if (mesh.normals && mesh.normals.length > 0) {
                buffers.normal = this.createBufferFromData(
                    new Float32Array(mesh.normals),
                    GPUBufferUsage.VERTEX
                );
            }
            
            if (mesh.texCoords && mesh.texCoords.length > 0) {
                buffers.texCoord = this.createBufferFromData(
                    new Float32Array(mesh.texCoords),
                    GPUBufferUsage.VERTEX
                );
            }
            
            if (mesh.indices && mesh.indices.length > 0) {
                buffers.index = this.createBufferFromData(
                    new Uint16Array(mesh.indices),
                    GPUBufferUsage.INDEX
                );
                buffers.indexCount = mesh.indices.length;
            } else {
                buffers.vertexCount = mesh.positions.length / 3;
            }
            
            this.bufferCache.set(primitive, buffers);
        }
        
        return buffers;
    }
    
    async getOrCreateTexture(textureData) {
        let texture = this.textureCache.get(textureData);
        
        if (!texture && textureData.image) {
            console.log('Creating texture:', textureData.image.src);
            texture = await this.createTexture(textureData.image);
            this.textureCache.set(textureData, texture);
            console.log('Texture created successfully');
        }
        
        return texture;
    }
    
    createModelBindGroup(modelMatrix) {
        // Create model uniform buffer (mat4 + mat4 = 128 bytes)
        const modelUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Calculate normal matrix
        const normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);
        
        // Convert 3x3 to 4x4 for alignment
        const normalMatrix4x4 = mat4.create();
        normalMatrix4x4[0] = normalMatrix[0];
        normalMatrix4x4[1] = normalMatrix[1];
        normalMatrix4x4[2] = normalMatrix[2];
        normalMatrix4x4[4] = normalMatrix[3];
        normalMatrix4x4[5] = normalMatrix[4];
        normalMatrix4x4[6] = normalMatrix[5];
        normalMatrix4x4[8] = normalMatrix[6];
        normalMatrix4x4[9] = normalMatrix[7];
        normalMatrix4x4[10] = normalMatrix[8];
        
        // Pack data
        const modelData = new Float32Array(32); // 128 bytes / 4
        modelData.set(modelMatrix, 0);
        modelData.set(normalMatrix4x4, 16);
        
        this.device.queue.writeBuffer(modelUniformBuffer, 0, modelData);
        
        return this.device.createBindGroup({
            layout: this.modelBindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: modelUniformBuffer }
            }]
        });
    }
    
    async createMaterialBindGroup(material) {
        const cacheKey = JSON.stringify({
            baseColorFactor: material.baseColorFactor,
            hasTexture: !!material.baseTexture
        });
        
        let bindGroup = this.bindGroupCache.get(cacheKey);
        
        if (!bindGroup) {
            // Material uniform buffer
            const materialUniformBuffer = this.device.createBuffer({
                size: 32, // vec4 + u32 + padding
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            
            const baseColorFactor = material.baseColorFactor || [1, 1, 1, 1];
            const hasBaseTexture = material.baseTexture ? 1 : 0;
            
            const materialData = new Float32Array(8);
            materialData.set(baseColorFactor, 0);
            new Uint32Array(materialData.buffer, 16, 1)[0] = hasBaseTexture;
            
            this.device.queue.writeBuffer(materialUniformBuffer, 0, materialData);
            
            // Get or create texture
            let texture = null;
            if (material.baseTexture) {
                texture = await this.getOrCreateTexture(material.baseTexture);
            }
            
            // If no texture, create a white 1x1 texture
            if (!texture) {
                texture = this.device.createTexture({
                    size: { width: 1, height: 1 },
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                });
                this.device.queue.writeTexture(
                    { texture },
                    new Uint8Array([255, 255, 255, 255]),
                    { bytesPerRow: 4 },
                    { width: 1, height: 1 }
                );
            }
            
            bindGroup = this.device.createBindGroup({
                layout: this.materialBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: materialUniformBuffer }
                    },
                    {
                        binding: 1,
                        resource: texture.createView()
                    },
                    {
                        binding: 2,
                        resource: this.defaultSampler
                    }
                ]
            });
            
            this.bindGroupCache.set(cacheKey, bindGroup);
        }
        
        return bindGroup;
    }
    
    render(scene, camera, blurEnabled = false) {
        // Update camera uniforms
        const cameraData = new Float32Array(36); // 144 bytes / 4
        cameraData.set(camera.viewMatrix, 0);
        cameraData.set(camera.projectionMatrix, 16);
        cameraData.set(camera.position, 32);
        this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraData);
        
        // Update light uniforms
        const lightData = new Float32Array(8); // 32 bytes / 4
        lightData.set([0.3, -1.0, 0.5], 0); // direction
        lightData.set([1.0, 1.0, 0.95], 4); // color
        this.device.queue.writeBuffer(this.lightUniformBuffer, 0, lightData);
        
        // Update post-process uniforms
        const postProcessData = new Uint32Array(4);
        postProcessData[0] = blurEnabled ? 1 : 0;
        this.device.queue.writeBuffer(this.postProcessUniformBuffer, 0, postProcessData);
        
        const commandEncoder = this.device.createCommandEncoder();
        
        // First pass: Render to texture
        const renderPassDescriptor = {
            colorAttachments: [{
                view: this.renderTextureView,
                clearValue: { r: 0.5, g: 0.6, b: 0.7, a: 1.0 }, // Sky blue
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };
        
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.mainPipeline);
        passEncoder.setBindGroup(0, this.cameraBindGroup);
        
        // Render all entities (synchronous)
        for (const entity of scene.entities) {
            this.renderEntitySync(passEncoder, entity);
        }
        
        passEncoder.end();
        
        // Second pass: Post-processing to canvas
        const canvasTexture = this.context.getCurrentTexture();
        const postPassDescriptor = {
            colorAttachments: [{
                view: canvasTexture.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
        
        const postPassEncoder = commandEncoder.beginRenderPass(postPassDescriptor);
        postPassEncoder.setPipeline(this.postProcessPipeline);
        postPassEncoder.setBindGroup(0, this.postProcessBindGroup);
        postPassEncoder.setVertexBuffer(0, this.quadBuffer);
        postPassEncoder.draw(4);
        postPassEncoder.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    renderEntitySync(passEncoder, entity) {
        const modelMatrix = entity.modelMatrix || mat4.create();
        const modelBindGroup = this.createModelBindGroup(modelMatrix);
        
        passEncoder.setBindGroup(1, modelBindGroup);
        
        if (entity.primitives) {
            for (const primitive of entity.primitives) {
                this.renderPrimitiveSync(passEncoder, primitive);
            }
        }
    }
    
    renderPrimitiveSync(passEncoder, primitive) {
        const buffers = this.getOrCreateBuffers(primitive);
        
        // Set vertex buffers
        if (buffers.position) {
            passEncoder.setVertexBuffer(0, buffers.position);
        }
        if (buffers.normal) {
            passEncoder.setVertexBuffer(1, buffers.normal);
        }
        if (buffers.texCoord) {
            passEncoder.setVertexBuffer(2, buffers.texCoord);
        }
        
        // Get or create material bind group
        let materialBindGroup = this.bindGroupCache.get(primitive);
        
        if (!materialBindGroup) {
            materialBindGroup = this.createPrimitiveMaterialBindGroup(primitive);
        }
        
        passEncoder.setBindGroup(2, materialBindGroup);
        
        // Draw
        if (buffers.index) {
            passEncoder.setIndexBuffer(buffers.index, 'uint16');
            passEncoder.drawIndexed(buffers.indexCount);
        } else {
            passEncoder.draw(buffers.vertexCount);
        }
    }
    
    getOrCreateDefaultMaterialBindGroup() {
        if (this.defaultMaterialBindGroup) {
            return this.defaultMaterialBindGroup;
        }
        
        // Material uniform buffer
        const materialUniformBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        const materialData = new Float32Array(8);
        materialData.set([1, 1, 1, 1], 0); // white
        new Uint32Array(materialData.buffer, 16, 1)[0] = 0; // no texture
        
        this.device.queue.writeBuffer(materialUniformBuffer, 0, materialData);
        
        // Create white 1x1 texture
        const whiteTexture = this.device.createTexture({
            size: { width: 1, height: 1 },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        this.device.queue.writeTexture(
            { texture: whiteTexture },
            new Uint8Array([255, 255, 255, 255]),
            { bytesPerRow: 4 },
            { width: 1, height: 1 }
        );
        
        this.defaultMaterialBindGroup = this.device.createBindGroup({
            layout: this.materialBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: materialUniformBuffer }
                },
                {
                    binding: 1,
                    resource: whiteTexture.createView()
                },
                {
                    binding: 2,
                    resource: this.defaultSampler
                }
            ]
        });
        
        return this.defaultMaterialBindGroup;
    }
    
    getMaterialBindGroupSync(material) {
        // Use primitive or material reference as cache key to ensure unique bind groups per material
        const cacheKey = material.baseTexture ? 
            `texture_${material.baseTexture.image ? material.baseTexture.image.src : 'default'}` :
            `color_${(material.baseColorFactor || [1,1,1,1]).join('_')}`;
        
        let bindGroup = this.bindGroupCache.get(cacheKey);
        
        if (bindGroup) {
            return bindGroup;
        }
        
        // Create material bind group synchronously
        const materialUniformBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        const baseColorFactor = material.baseColorFactor || [1, 1, 1, 1];
        
        // Get texture (should be cached by now)
        let texture = null;
        let hasBaseTexture = 0;
        
        if (material.baseTexture) {
            texture = this.textureCache.get(material.baseTexture);
            if (texture) {
                hasBaseTexture = 1;
            }
        }
        
        const materialData = new Float32Array(8);
        materialData.set(baseColorFactor, 0);
        new Uint32Array(materialData.buffer, 16, 1)[0] = hasBaseTexture;
        
        this.device.queue.writeBuffer(materialUniformBuffer, 0, materialData);
        
        // If no texture, use white 1x1
        if (!texture) {
            if (!this.whiteTexture) {
                this.whiteTexture = this.device.createTexture({
                    size: { width: 1, height: 1 },
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                });
                this.device.queue.writeTexture(
                    { texture: this.whiteTexture },
                    new Uint8Array([255, 255, 255, 255]),
                    { bytesPerRow: 4 },
                    { width: 1, height: 1 }
                );
            }
            texture = this.whiteTexture;
        }
        
        bindGroup = this.device.createBindGroup({
            layout: this.materialBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: materialUniformBuffer }
                },
                {
                    binding: 1,
                    resource: texture.createView()
                },
                {
                    binding: 2,
                    resource: this.defaultSampler
                }
            ]
        });
        
        this.bindGroupCache.set(cacheKey, bindGroup);
        return bindGroup;
    }
    
    // Async method to pre-load textures
    async preloadTextures(scene) {
        console.log('Starting texture preload...');
        const promises = [];
        
        for (const entity of scene.entities) {
            if (entity.primitives) {
                for (const primitive of entity.primitives) {
                    const material = primitive.material;
                    if (material && material.baseTexture && !this.textureCache.has(material.baseTexture)) {
                        promises.push(this.getOrCreateTexture(material.baseTexture));
                    }
                }
            }
        }
        
        await Promise.all(promises);
        console.log(`Preloaded ${promises.length} textures`);
        
        // Now create all material bind groups
        console.log('Creating material bind groups...');
        for (const entity of scene.entities) {
            if (entity.primitives) {
                for (const primitive of entity.primitives) {
                    if (!this.bindGroupCache.has(primitive)) {
                        this.createPrimitiveMaterialBindGroup(primitive);
                    }
                }
            }
        }
        console.log('All material bind groups created');
    }
    
    createPrimitiveMaterialBindGroup(primitive) {
        const material = primitive.material || {};
        
        // Create material uniform buffer
        const materialUniformBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        const baseColorFactor = material.baseColorFactor || [1, 1, 1, 1];
        let hasBaseTexture = 0;
        let texture = null;
        
        // Get cached texture if available
        if (material.baseTexture) {
            texture = this.textureCache.get(material.baseTexture);
            if (texture) {
                hasBaseTexture = 1;
            }
        }
        
        const materialData = new Float32Array(8);
        materialData.set(baseColorFactor, 0);
        new Uint32Array(materialData.buffer, 16, 1)[0] = hasBaseTexture;
        
        this.device.queue.writeBuffer(materialUniformBuffer, 0, materialData);
        
        // Use white texture if no texture available
        if (!texture) {
            if (!this.whiteTexture) {
                this.whiteTexture = this.device.createTexture({
                    size: { width: 1, height: 1 },
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                });
                this.device.queue.writeTexture(
                    { texture: this.whiteTexture },
                    new Uint8Array([255, 255, 255, 255]),
                    { bytesPerRow: 4 },
                    { width: 1, height: 1 }
                );
            }
            texture = this.whiteTexture;
        }
        
        const materialBindGroup = this.device.createBindGroup({
            layout: this.materialBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: materialUniformBuffer }
                },
                {
                    binding: 1,
                    resource: texture.createView()
                },
                {
                    binding: 2,
                    resource: this.defaultSampler
                }
            ]
        });
        
        this.bindGroupCache.set(primitive, materialBindGroup);
        return materialBindGroup;
    }
}
