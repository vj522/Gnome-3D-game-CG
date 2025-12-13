import { mat4, mat3 } from './lib/glm.js';

export class Renderer {
    constructor(gl, shaderProgram, postProcessProgram) {
        this.gl = gl;
        this.program = shaderProgram;
        this.postProcessProgram = postProcessProgram;
        
        // Get all uniform and attribute locations
        this.locations = {
            // Attributes
            aPosition: gl.getAttribLocation(shaderProgram, 'aPosition'),
            aNormal: gl.getAttribLocation(shaderProgram, 'aNormal'),
            aTexCoord: gl.getAttribLocation(shaderProgram, 'aTexCoord'),
            
            // Matrix uniforms
            uModelMatrix: gl.getUniformLocation(shaderProgram, 'uModelMatrix'),
            uViewMatrix: gl.getUniformLocation(shaderProgram, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            uNormalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
            
            // Material uniforms
            uBaseColorFactor: gl.getUniformLocation(shaderProgram, 'uBaseColorFactor'),
            uBaseTexture: gl.getUniformLocation(shaderProgram, 'uBaseTexture'),
            uHasBaseTexture: gl.getUniformLocation(shaderProgram, 'uHasBaseTexture'),
            
            // Lighting uniforms
            uCameraPosition: gl.getUniformLocation(shaderProgram, 'uCameraPosition'),
            uLightDirection: gl.getUniformLocation(shaderProgram, 'uLightDirection'),
            uLightColor: gl.getUniformLocation(shaderProgram, 'uLightColor'),
        };
        
        // Cache for WebGL resources
        this.bufferCache = new Map();
        this.textureCache = new Map();
        this.vaoCache = new Map();
        
        // Post-process locations
        this.postLocations = {
            aPosition: gl.getAttribLocation(postProcessProgram, 'aPosition'),
            aTexCoord: gl.getAttribLocation(postProcessProgram, 'aTexCoord'),
            uScreenTexture: gl.getUniformLocation(postProcessProgram, 'uScreenTexture'),
            uBlurEnabled: gl.getUniformLocation(postProcessProgram, 'uBlurEnabled'),
        };
        
        // Create framebuffer for post-processing
        this.setupPostProcessing();
    }
    
    setupPostProcessing() {
        const gl = this.gl;
        
        // Create framebuffer
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        
        // Create texture to render to
        this.frameTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Attach texture to framebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.frameTexture, 0);
        
        // Create depth buffer
        this.depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
        
        // Check framebuffer status
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete');
        }
        
        // Unbind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Create full-screen quad for post-processing
        const quadVertices = new Float32Array([
            -1, -1,  0, 0,  // Bottom-left
             1, -1,  1, 0,  // Bottom-right
            -1,  1,  0, 1,  // Top-left
             1,  1,  1, 1,  // Top-right
        ]);
        
        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);
        
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(this.postLocations.aPosition);
        gl.vertexAttribPointer(this.postLocations.aPosition, 2, gl.FLOAT, false, 16, 0);
        
        gl.enableVertexAttribArray(this.postLocations.aTexCoord);
        gl.vertexAttribPointer(this.postLocations.aTexCoord, 2, gl.FLOAT, false, 16, 8);
        
        gl.bindVertexArray(null);
    }
    
    resizePostProcessing(width, height) {
        const gl = this.gl;
        
        // Resize frame texture
        gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
        // Resize depth buffer
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }
    
    createBufferFromData(data, target = this.gl.ARRAY_BUFFER) {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return buffer;
    }
    
    createTexture(image) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Upload image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Generate mipmaps
        gl.generateMipmap(gl.TEXTURE_2D);
        
        return texture;
    }
    
    createVAO(primitive) {
        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        
        const mesh = primitive.mesh;
        
        // Position buffer
        if (mesh.positions && mesh.positions.length > 0) {
            const posBuffer = this.createBufferFromData(new Float32Array(mesh.positions));
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(this.locations.aPosition);
            gl.vertexAttribPointer(this.locations.aPosition, 3, gl.FLOAT, false, 0, 0);
        }
        
        // Normal buffer
        if (mesh.normals && mesh.normals.length > 0) {
            const normBuffer = this.createBufferFromData(new Float32Array(mesh.normals));
            gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
            gl.enableVertexAttribArray(this.locations.aNormal);
            gl.vertexAttribPointer(this.locations.aNormal, 3, gl.FLOAT, false, 0, 0);
        }
        
        // Texture coordinate buffer
        if (mesh.texCoords && mesh.texCoords.length > 0) {
            const texBuffer = this.createBufferFromData(new Float32Array(mesh.texCoords));
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
            gl.enableVertexAttribArray(this.locations.aTexCoord);
            gl.vertexAttribPointer(this.locations.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        }
        
        // Index buffer
        let indexBuffer = null;
        if (mesh.indices && mesh.indices.length > 0) {
            indexBuffer = this.createBufferFromData(
                new Uint16Array(mesh.indices), 
                gl.ELEMENT_ARRAY_BUFFER
            );
        }
        
        gl.bindVertexArray(null);
        
        return { vao, indexBuffer, indexCount: mesh.indices ? mesh.indices.length : mesh.positions.length / 3 };
    }
    
    render(scene, camera, blurEnabled = false) {
        const gl = this.gl;
        
        // First pass: Render scene to framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Use shader program
        gl.useProgram(this.program);
        
        // Get camera matrices
        const viewMatrix = camera.viewMatrix;
        const projectionMatrix = camera.projectionMatrix;
        const cameraPosition = camera.position;
        
        // Set view and projection matrices (same for all objects)
        gl.uniformMatrix4fv(this.locations.uViewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.locations.uProjectionMatrix, false, projectionMatrix);
        
        // Set camera position
        gl.uniform3fv(this.locations.uCameraPosition, cameraPosition);
        
        // Set light direction (from above and slightly from front)
        gl.uniform3fv(this.locations.uLightDirection, [0.3, -1.0, 0.5]);
        gl.uniform3fv(this.locations.uLightColor, [1.0, 1.0, 0.95]);
        
        // Render all entities in scene
        for (const entity of scene.entities) {
            this.renderEntity(entity);
        }
        
        // Second pass: Apply post-processing
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(this.postProcessProgram);
        
        // Bind frame texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
        gl.uniform1i(this.postLocations.uScreenTexture, 0);
        gl.uniform1i(this.postLocations.uBlurEnabled, blurEnabled ? 1 : 0);
        
        // Draw full-screen quad
        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
    }
    
    renderEntity(entity) {
        const gl = this.gl;
        
        // Get model matrix from entity's transform
        const modelMatrix = entity.modelMatrix || mat4.create();
        
        // Calculate normal matrix
        const normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);
        
        // Set model matrix
        gl.uniformMatrix4fv(this.locations.uModelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(this.locations.uNormalMatrix, false, normalMatrix);
        
        // Render all primitives in the entity
        if (entity.primitives) {
            for (const primitive of entity.primitives) {
                this.renderPrimitive(primitive);
            }
        }
    }
    
    renderPrimitive(primitive) {
        const gl = this.gl;
        
        // Get or create VAO for this primitive
        let vaoData = this.vaoCache.get(primitive);
        if (!vaoData) {
            vaoData = this.createVAO(primitive);
            this.vaoCache.set(primitive, vaoData);
        }
        
        // Set material properties
        const material = primitive.material || {};
        const baseColorFactor = material.baseColorFactor || [1, 1, 1, 1];
        gl.uniform4fv(this.locations.uBaseColorFactor, baseColorFactor);
        
        // Handle texture
        if (material.baseTexture) {
            // Get or create texture
            let texture = this.textureCache.get(material.baseTexture);
            if (!texture && material.baseTexture.image) {
                texture = this.createTexture(material.baseTexture.image);
                this.textureCache.set(material.baseTexture, texture);
            }
            
            if (texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(this.locations.uBaseTexture, 0);
                gl.uniform1i(this.locations.uHasBaseTexture, 1);
            } else {
                gl.uniform1i(this.locations.uHasBaseTexture, 0);
            }
        } else {
            gl.uniform1i(this.locations.uHasBaseTexture, 0);
        }
        
        // Bind VAO and draw
        gl.bindVertexArray(vaoData.vao);
        
        if (vaoData.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vaoData.indexBuffer);
            gl.drawElements(gl.TRIANGLES, vaoData.indexCount, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, vaoData.indexCount);
        }
        
        gl.bindVertexArray(null);
    }
}
