import { mat4, vec3 } from './lib/glm.js';
import { Camera } from './engine/core/Camera.js'
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { Transform } from './engine/core/Transform.js';

import { Scene } from './engine/scene/Scene.js';
import { ForestScene } from './engine/scene/ForestScene.js';
import { CaveScene } from './engine/scene/CaveScene.js';


export class Game {

    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;

        // Create player camera
        this.camera = new Camera({
            aspect: canvas.width / canvas.height,
            fovy: Math.PI / 3, // 60 degrees
            near: 0.1,
            far: 5000, // Increased from 1000 to 5000
        });

        
        // Create a transform component for the player
        this.transform = new Transform({
            translation: [0, 30.0, 0], // Player starting height for forest, the first starting point
            // translation: [-20,0,-66], //start point za cave
            rotation: [0, 0, 0, 1],  //forest
            scale: [1, 1, 1],
        });
        
        // Create first person controller
        this.controller = new FirstPersonController(this, canvas, {
            pitch: 0,
            yaw: 0,
            // yaw: 3.14,  //enter the cave
            velocity: [0, 0, 0],
            acceleration: 20,
            maxSpeed: 8,
            decay: 0.99999,
            pointerSensitivity: 0.002,
        });
        

        // Jump mechanics
        this.gravity = -20.0; // Gravity acceleration
        this.jumpVelocity = 15.0; // Initial jump velocity (increased for higher jumps)
        this.isOnGround = true;
        
        // Torch light toggle (Shift key)
        this.torchLightEnabled = false;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.torchLightEnabled = !this.torchLightEnabled; // Toggle
            }
        });
        
        // Visual effects
        this.blurEnabled = false;

        //bounding box za playerja
        this.aabb = {
            min: [0,0,0],
            max: [0,0,0],
        }; 


        this.forestScene = null;
        this.caveScene = null;

                
        // Add key handler for blur toggle
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Digit8') {
                this.blurEnabled = !this.blurEnabled;
                console.log('Blur effect:', this.blurEnabled ? 'ON' : 'OFF');
            }
        });


        // // Floor height (for collision)
        // this.floorHeight = 26.0; // Fallback forest floor height
        // this.floorMesh = null; // will hold triangle list for exact collisions
        

        this.scene = null; 
    }

    async init_scene(){
        //load scene (forest), later switch to cave
        // this.scene = new ForestScene(this);
        this.forestScene = new ForestScene(this);
        this.caveScene = new CaveScene(this);
        this.caveScene.initTargetScene(this.forestScene);
        this.forestScene.initTargetScene(this.caveScene);
        this.scene = this.forestScene;
        await this.scene.load();

        // Prepare camera object for renderer
        this.updateCameraMatrices();
    }


    
    update(deltaTime) {
        
        // console.log(this.isOnGround)
        // console.log(this.transform.translation[1])
        // Update controller (handles movement)
        this.controller.update(0, deltaTime);
        
        // Apply gravity
        this.controller.velocity[1] += this.gravity * deltaTime;
        

        // Apply floor collision (keep camera at eye level above floor)
        const floorY = this.scene.floorPhysics.getFloorHeightAt(this.transform.translation[0], this.transform.translation[2]);

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

        //logging coordinates when moved
        const speed = Math.hypot(this.controller.velocity[0], this.controller.velocity[2]);
        // if (speed > 0.01) { // small threshold to avoid logging tiny movements
        //     console.log("Player coordinates:", this.transform.translation);
        //     console.log("Player rotation:", this.transform.rotation);
        // }

        
        // console.log(this.transform.translation);
        //scene specific physics, resolve collisions with objects
        this.scene.physics.update(0, deltaTime);

        // Update items vezane na kamero (bakla v jami)
        this.scene.updateHeldItems?.(this.transform, this.controller.velocity);
        
        // Update camera matrices
        this.updateCameraMatrices();


        //SCENE TRIGGER
        const PlayerPosition = this.transform.translation;
        const newScene = this.scene.checkTriggers(PlayerPosition); //vrne null ali novo sceno

        if (newScene){
            this.changeScene(newScene);
        }


    }

    async changeScene(newScene) {
        console.log("Switching scenes...");

        //new scene je sceneTriggers z bounds, target scene, position, zay, triggered?


        const sceneInstance = newScene.targetScene;

        await sceneInstance.load();                // Load GLTF, setup entities
        await this.renderer.preloadTextures(sceneInstance); // Upload textures to GPU

        this.scene = sceneInstance;
        this.scene.sceneTrigger.triggered = true;

        this.transform.translation = newScene.targetPosition;
        this.controller.yaw = newScene.targetYaw;


        // // Reset player position if needed
        // if (newScene==ForestScene){
        //     this.transform.translation = [3.021825211729329, 27.88363407877016, -18.413587828218382];
        //     this.yaw = 0
        // }
        // else
        //     this.transform.translation = [-20,0,-66];  //??? kam pademo v startu ko preidemo

        // Update camera matrices for renderer
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
        this.renderer.render(this.scene, this.camera, this.blurEnabled, this.torchLightEnabled);
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
