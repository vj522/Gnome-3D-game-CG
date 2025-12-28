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
        
    }

    async init_scene(){
        //load scene (forest), later switch to cave
        this.scene = new ForestScene(this);
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
        
        const scene = this.scene; //active scene

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
        if (speed > 0.01) { // small threshold to avoid logging tiny movements
            console.log("Player coordinates:", this.transform.translation);
        }
        
        // console.log(this.transform.translation);
        //scene specific physics, resolve collisions with objects
        scene.physics.update(0, deltaTime);
        
        // Update camera matrices
        this.updateCameraMatrices();


        //SCENE TRIGGER
        const PlayerPosition = this.transform.translation;
        const newScene = this.scene.checkTriggers(PlayerPosition); //vrne null ani novo sceno

        if (newScene){
            this.changeScene(newScene);
        }


    }

    async changeScene(newScene) {
        console.log("Switching scenes...");

        this.scene = new newScene(this);
        await this.scene.load();

        // Reset player position if needed
        if (newScene==ForestScene)
            this.transform.translation = [3.021825211729329, 27.88363407877016, -18.413587828218382];
        else
            this.transform.translation = [0, 10, 0];  //??? kam pademo v startu ko preidemo

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
