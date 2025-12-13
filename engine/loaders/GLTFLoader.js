import { mat4, quat, vec3 } from '../../lib/glm.js';

export class GLTFLoader {
    constructor() {
        this.baseUrl = '';
    }
    
    async load(url) {
        this.baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load GLTF: ${url}`);
        }
        
        const gltf = await response.json();
        console.log('GLTF loaded:', gltf);
        
        // Load all buffers
        const buffers = await this.loadBuffers(gltf);
        
        // Load all images
        const images = await this.loadImages(gltf);
        
        // Parse the scene
        return this.parseScene(gltf, buffers, images);
    }
    
    async loadBuffers(gltf) {
        if (!gltf.buffers) return [];
        
        const buffers = [];
        for (const bufferInfo of gltf.buffers) {
            const url = this.baseUrl + bufferInfo.uri;
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            buffers.push(arrayBuffer);
        }
        return buffers;
    }
    
    async loadImages(gltf) {
        if (!gltf.images) return [];
        
        const images = [];
        for (const imageInfo of gltf.images) {
            const url = this.baseUrl + imageInfo.uri;
            const image = await this.loadImage(url);
            images.push(image);
        }
        return images;
    }
    
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = url;
        });
    }
    
    parseScene(gltf, buffers, images) {
        // Get default scene
        const sceneIndex = gltf.scene || 0;
        const scene = gltf.scenes[sceneIndex];
        
        const entities = [];
        
        // Process all nodes in the scene
        for (const nodeIndex of scene.nodes) {
            const nodeEntities = this.processNode(gltf, nodeIndex, buffers, images, mat4.create());
            entities.push(...nodeEntities);
        }
        
        console.log(`Loaded ${entities.length} entities from GLTF`);
        
        return { entities };
    }
    
    processNode(gltf, nodeIndex, buffers, images, parentMatrix) {
        const node = gltf.nodes[nodeIndex];
        const entities = [];
        
        // Calculate this node's transform
        let localMatrix = mat4.create();
        
        if (node.matrix) {
            localMatrix = mat4.clone(node.matrix);
        } else {
            const translation = node.translation || [0, 0, 0];
            const rotation = node.rotation || [0, 0, 0, 1];
            const scale = node.scale || [1, 1, 1];
            mat4.fromRotationTranslationScale(localMatrix, rotation, translation, scale);
        }
        
        // Combine with parent matrix
        const worldMatrix = mat4.create();
        mat4.multiply(worldMatrix, parentMatrix, localMatrix);
        
        // If this node has a mesh, create an entity
        if (node.mesh !== undefined) {
            const entity = this.createEntityFromMesh(
                gltf, 
                node.mesh, 
                buffers, 
                images, 
                worldMatrix
            );
            if (entity) {
                entities.push(entity);
            }
        }
        
        // Process children
        if (node.children) {
            for (const childIndex of node.children) {
                const childEntities = this.processNode(
                    gltf, 
                    childIndex, 
                    buffers, 
                    images, 
                    worldMatrix
                );
                entities.push(...childEntities);
            }
        }
        
        return entities;
    }
    
    createEntityFromMesh(gltf, meshIndex, buffers, images, modelMatrix) {
        const mesh = gltf.meshes[meshIndex];
        const primitives = [];
        
        for (const gltfPrimitive of mesh.primitives) {
            const primitive = this.parsePrimitive(gltf, gltfPrimitive, buffers, images);
            if (primitive) {
                primitives.push(primitive);
            }
        }
        
        if (primitives.length === 0) return null;
        
        return {
            modelMatrix,
            primitives,
        };
    }
    
    parsePrimitive(gltf, gltfPrimitive, buffers, images) {
        const mesh = {
            positions: null,
            normals: null,
            texCoords: null,
            indices: null,
        };
        
        // Parse attributes
        if (gltfPrimitive.attributes.POSITION !== undefined) {
            mesh.positions = this.parseAccessor(gltf, gltfPrimitive.attributes.POSITION, buffers);
        }
        
        if (gltfPrimitive.attributes.NORMAL !== undefined) {
            mesh.normals = this.parseAccessor(gltf, gltfPrimitive.attributes.NORMAL, buffers);
        }
        
        if (gltfPrimitive.attributes.TEXCOORD_0 !== undefined) {
            mesh.texCoords = this.parseAccessor(gltf, gltfPrimitive.attributes.TEXCOORD_0, buffers);
        }
        
        // Parse indices
        if (gltfPrimitive.indices !== undefined) {
            mesh.indices = this.parseAccessor(gltf, gltfPrimitive.indices, buffers);
        }
        
        // Parse material
        let material = null;
        if (gltfPrimitive.material !== undefined) {
            material = this.parseMaterial(gltf, gltfPrimitive.material, images);
        }
        
        return { mesh, material };
    }
    
    parseAccessor(gltf, accessorIndex, buffers) {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const buffer = buffers[bufferView.buffer];
        
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const componentCount = this.getComponentCount(accessor.type);
        const componentType = accessor.componentType;
        
        let TypedArray;
        switch (componentType) {
            case 5120: TypedArray = Int8Array; break;
            case 5121: TypedArray = Uint8Array; break;
            case 5122: TypedArray = Int16Array; break;
            case 5123: TypedArray = Uint16Array; break;
            case 5125: TypedArray = Uint32Array; break;
            case 5126: TypedArray = Float32Array; break;
            default: throw new Error('Unknown component type: ' + componentType);
        }
        
        const elementSize = TypedArray.BYTES_PER_ELEMENT * componentCount;
        const stride = bufferView.byteStride || elementSize;
        
        // If no stride, return simple array
        if (stride === elementSize) {
            return Array.from(new TypedArray(
                buffer, 
                byteOffset, 
                accessor.count * componentCount
            ));
        }
        
        // Handle strided data
        const result = [];
        const dataView = new DataView(buffer, byteOffset);
        for (let i = 0; i < accessor.count; i++) {
            for (let j = 0; j < componentCount; j++) {
                const offset = i * stride + j * TypedArray.BYTES_PER_ELEMENT;
                result.push(this.readComponent(dataView, offset, componentType));
            }
        }
        return result;
    }
    
    readComponent(dataView, offset, componentType) {
        switch (componentType) {
            case 5120: return dataView.getInt8(offset);
            case 5121: return dataView.getUint8(offset);
            case 5122: return dataView.getInt16(offset, true);
            case 5123: return dataView.getUint16(offset, true);
            case 5125: return dataView.getUint32(offset, true);
            case 5126: return dataView.getFloat32(offset, true);
        }
    }
    
    getComponentCount(type) {
        switch (type) {
            case 'SCALAR': return 1;
            case 'VEC2': return 2;
            case 'VEC3': return 3;
            case 'VEC4': return 4;
            case 'MAT2': return 4;
            case 'MAT3': return 9;
            case 'MAT4': return 16;
            default: return 1;
        }
    }
    
    parseMaterial(gltf, materialIndex, images) {
        const gltfMaterial = gltf.materials[materialIndex];
        const material = {
            baseColorFactor: [1, 1, 1, 1],
            baseTexture: null,
        };
        
        if (gltfMaterial.pbrMetallicRoughness) {
            const pbr = gltfMaterial.pbrMetallicRoughness;
            
            if (pbr.baseColorFactor) {
                material.baseColorFactor = pbr.baseColorFactor;
            }
            
            if (pbr.baseColorTexture) {
                const textureIndex = pbr.baseColorTexture.index;
                const texture = gltf.textures[textureIndex];
                const imageIndex = texture.source;
                material.baseTexture = {
                    image: images[imageIndex],
                };
            }
        }
        
        return material;
    }
}
