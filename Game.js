import { mat4, vec3 } from './lib/glm.js';
import { Camera } from './engine/core/Camera.js'
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { Transform } from './engine/core/Transform.js';
import { Physics } from './engine/physics/Physics.js';

export class Game {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.scene = { entities: [] };
        this.collisions = { entities: [] };
        
        // Create player camera
        this.camera = new Camera({
            aspect: canvas.width / canvas.height,
            fovy: Math.PI / 3, // 60 degrees
            near: 0.1,
            far: 5000, // Increased from 1000 to 5000
        });

        
        
        // Create a transform component for the player
        this.transform = new Transform({
            translation: [0, 30.0, 0], // Player starting height
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
        });
        
        // Create first person controller
        this.controller = new FirstPersonController(this, canvas, {
            pitch: 0,
            yaw: 0,
            velocity: [0, 0, 0],
            acceleration: 20,
            maxSpeed: 8,
            decay: 0.99999,
            pointerSensitivity: 0.002,
        });
        
        // Floor height (for collision)
        this.floorHeight = 26.0; // Fallback forest floor height
        this.floorMesh = null; // will hold triangle list for exact collisions
        
        // Jump mechanics
        this.gravity = -20.0; // Gravity acceleration
        this.jumpVelocity = 15.0; // Initial jump velocity (increased for higher jumps)
        this.isOnGround = true;
        
        // Visual effects
        this.blurEnabled = false;

        //bounding box za playerja
        this.aabb = {
            min: [0,0,0],
            max: [0,0,0],
        }; 

        // Initiate physics
        this.physics = new Physics(this, this.collisions);
        
        // Add key handler for blur toggle
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Digit8') {
                this.blurEnabled = !this.blurEnabled;
                console.log('Blur effect:', this.blurEnabled ? 'ON' : 'OFF');
            }
        });
        
        // Prepare camera object for renderer
        this.updateCameraMatrices();
    }

    // Build floor collision mesh from a GLTF entity (or array of entities)
    setFloorCollision(entities) {
        const ents = Array.isArray(entities) ? entities : [entities];
        const triangles = [];

        for (const entity of ents) {
            const modelMatrix = entity.modelMatrix || entity.modelMatrix;
            for (const primitive of entity.primitives) {
                const positions = primitive.mesh.positions;
                const indices = primitive.mesh.indices;

                if (!positions) continue;

                if (indices && indices.length > 0) {
                    for (let i = 0; i < indices.length; i += 3) {
                        const ia = indices[i] * 3;
                        const ib = indices[i + 1] * 3;
                        const ic = indices[i + 2] * 3;

                        const a = vec3.fromValues(positions[ia], positions[ia + 1], positions[ia + 2]);
                        const b = vec3.fromValues(positions[ib], positions[ib + 1], positions[ib + 2]);
                        const c = vec3.fromValues(positions[ic], positions[ic + 1], positions[ic + 2]);

                        vec3.transformMat4(a, a, modelMatrix);
                        vec3.transformMat4(b, b, modelMatrix);
                        vec3.transformMat4(c, c, modelMatrix);

                        triangles.push([a, b, c]);
                    }
                } else {
                    // assume triangles in sequence
                    for (let i = 0; i < positions.length; i += 9) {
                        const a = vec3.fromValues(positions[i], positions[i + 1], positions[i + 2]);
                        const b = vec3.fromValues(positions[i + 3], positions[i + 4], positions[i + 5]);
                        const c = vec3.fromValues(positions[i + 6], positions[i + 7], positions[i + 8]);

                        vec3.transformMat4(a, a, modelMatrix);
                        vec3.transformMat4(b, b, modelMatrix);
                        vec3.transformMat4(c, c, modelMatrix);

                        triangles.push([a, b, c]);
                    }
                }
            }
        }

        this.floorMesh = { triangles };
    }

    // Moller-Trumbore ray-triangle intersection. Returns distance t or null.
    rayIntersectTriangle(orig, dir, v0, v1, v2) {
        const EPSILON = 1e-6;
        const edge1 = vec3.create();
        const edge2 = vec3.create();
        vec3.sub(edge1, v1, v0);
        vec3.sub(edge2, v2, v0);

        const pvec = vec3.create();
        vec3.cross(pvec, dir, edge2);

        const det = vec3.dot(edge1, pvec);
        if (det > -EPSILON && det < EPSILON) return null;
        const invDet = 1.0 / det;

        const tvec = vec3.create();
        vec3.sub(tvec, orig, v0);
        const u = vec3.dot(tvec, pvec) * invDet;
        if (u < 0 || u > 1) return null;

        const qvec = vec3.create();
        vec3.cross(qvec, tvec, edge1);
        const v = vec3.dot(dir, qvec) * invDet;
        if (v < 0 || u + v > 1) return null;

        const t = vec3.dot(edge2, qvec) * invDet;
        if (t > EPSILON) return t;
        return null;
    }

    // Get floor height (y) at world X,Z by raycasting down from above
    getFloorHeightAt(x, z) {
        if (!this.floorMesh || !this.floorMesh.triangles || this.floorMesh.triangles.length === 0) {
            return this.floorHeight;
        }

        const origin = vec3.fromValues(x, 1000.0, z);
        const dir = vec3.fromValues(0, -1, 0);

        let closestT = Infinity;
        let hitY = null;

        for (const tri of this.floorMesh.triangles) {
            const t = this.rayIntersectTriangle(origin, dir, tri[0], tri[1], tri[2]);
            if (t !== null && t < closestT) {
                closestT = t;
                hitY = origin[1] + dir[1] * t;
            }
        }

        if (hitY === null) return this.floorHeight;
        return hitY;
    }
    
    addEntity(entity) {
        this.scene.entities.push(entity);
    }
    
    addEntities(entities) {
        // console.log(entities)
        this.scene.entities.push(...entities);
    }

    addEntityBox(entity) {
        this.collisions.entities.push(entity);
    }
    
    addEntitiesBox(entities) {
        // console.log(entities)
        this.collisions.entities.push(...entities);
    }

    changeToVec(entities) {
        for (const entity of entities){
            for (const primitive of entity.primitives){
                const positions = primitive.mesh.positions;
                primitive.mesh.vertices = []
                for (let i = 0; i < positions.length; i += 3) {
                    const v = vec3.fromValues(
                        positions[i],
                        positions[i + 1],
                        positions[i + 2]
                    );
                    primitive.mesh.vertices.push(v);
                }
            }
        }
    }

    addTransform(entities){
        for (const entity of entities){
            entity.transform = new Transform({
                matrix: mat4.clone(entity.modelMatrix)
            });
        }
    }
    
    update(deltaTime) {
        // console.log(this.isOnGround)
        // console.log(this.transform.translation[1])
        // Update controller (handles movement)
        this.controller.update(0, deltaTime);
        
        // Apply gravity
        this.controller.velocity[1] += this.gravity * deltaTime;
        
        // Apply floor collision (keep camera at eye level above floor)
        const floorY = this.getFloorHeightAt(this.transform.translation[0], this.transform.translation[2]);
        const eyeLevel = floorY + 1.8;
        if (this.transform.translation[1] <= eyeLevel) {
            this.transform.translation[1] = eyeLevel;
            // Stop vertical velocity and mark as on ground
            if (this.controller.velocity[1] < 0) {
                this.controller.velocity[1] = 0;
            }
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }
        
        // Handle jump (space bar)
        if (this.controller.keys['Space'] && this.isOnGround) {
            this.controller.velocity[1] = this.jumpVelocity;
            this.isOnGround = false;
        }

        // console.log(this.transform.translation);

        this.physics.update(0, deltaTime);
        
        // Update camera matrices
        this.updateCameraMatrices();
    }
    
    updateCameraMatrices() {
        // Update camera aspect ratio if window resized
        this.camera.aspect = this.canvas.width / this.canvas.height;
        
        // Create view matrix from transform
        const modelMatrix = this.transform.matrix;
        const viewMatrix = mat4.invert(mat4.create(), modelMatrix);
        
        // Store matrices for renderer (projectionMatrix is already a getter in Camera)
        this.camera.viewMatrix = viewMatrix;
        this.camera.position = this.transform.translation;
    }
    
    render() {
        this.renderer.render(this.scene, this.camera, this.blurEnabled);
    }
    
    // Methods for FirstPersonController compatibility
    getComponentOfType(type) {
        // FirstPersonController expects to get Transform component
        if (type === Transform || type.name === 'Transform') {
            return this.transform;
        }
        return null;
    }
    
    handleResize() {
        this.camera.aspect = this.canvas.width / this.canvas.height;
    }
}
