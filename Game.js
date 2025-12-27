import { mat4, vec3 } from './lib/glm.js';
import { Camera } from './engine/core/Camera.js'
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { Transform } from './engine/core/Transform.js';
import { Physics } from './engine/Physics.js';

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
        this.floorHeight = 24.0; // Forest floor is at this height
        
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
        console.log(this.isOnGround)
        console.log(this.transform.translation[1])
        // Update controller (handles movement)
        this.controller.update(0, deltaTime);
        
        // Apply gravity
        this.controller.velocity[1] += this.gravity * deltaTime;
        
        // Apply floor collision (keep camera at eye level above floor)
        const eyeLevel = this.floorHeight + 1.8;
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
