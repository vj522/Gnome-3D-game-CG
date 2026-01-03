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
        
        // Visual effects
        this.blurEnabled = false;

        //bounding box za playerja
        this.aabb = {
            min: [0,0,0],
            max: [0,0,0],
        };

        // Object tracking arrays
        this.correct = []; // First 3 objects spawned at game start
        this.wrong = [];   // Objects spawned after first 3
        this.collected = []; // Objects that have been collected
        this.correct_name = []; // Paths of objects in correct array
        this.objectCount = 0; // Counter to track when first 3 objects have been spawned
        this.collectionRadius = 15.0; // Radius for nearby object detection
        
        // Blur effect timer
        this.blurTimer = null; // Timer for temporary blur effect


        this.forestScene = null;
        this.caveScene = null;

                
        // Add key handler for blur toggle
        // Initiate physics
        this.physics = new Physics(this, this.collisions);
        this.floorPhysics = new FloorPhysics();
        
        // Add key handlers
        document.addEventListener('keydown', (e) => {
            // Blur toggle (Digit8)
            if (e.code === 'Digit8') {
                this.blurEnabled = !this.blurEnabled;
                console.log('Blur effect:', this.blurEnabled ? 'ON' : 'OFF');
            }
            // Collect objects (P)
            if (e.code === 'KeyP') {
                this.tryCollectNearbyObject();
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


    
    /**
     * Finds nearby objects within the collection radius
     * @returns {Array} Array of objects from the correct array that are nearby
     */
    getNearbyCorrectObjects() {
        const playerPos = this.transform.translation;
        const nearbyObjects = [];
        
        for (const entity of this.correct) {
            if (!entity.transform) continue;
            
            const objPos = entity.transform.translation;
            const dx = objPos[0] - playerPos[0];
            const dy = objPos[1] - playerPos[1];
            const dz = objPos[2] - playerPos[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance <= this.collectionRadius) {
                nearbyObjects.push(entity);
            }
        }
        
        return nearbyObjects;
    }
    
    /**
     * Finds nearby objects within the collection radius from wrong array
     * @returns {Array} Array of objects from the wrong array that are nearby
     */
    getNearbyWrongObjects() {
        const playerPos = this.transform.translation;
        const nearbyObjects = [];
        
        for (const entity of this.wrong) {
            if (!entity.transform) continue;
            
            const objPos = entity.transform.translation;
            const dx = objPos[0] - playerPos[0];
            const dy = objPos[1] - playerPos[1];
            const dz = objPos[2] - playerPos[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance <= this.collectionRadius) {
                nearbyObjects.push(entity);
            }
        }
        
        return nearbyObjects;
    }
    
    /**
     * Activates blur effect for a specified duration
     * @param {number} duration - Duration in milliseconds
     */
    activateBlurForDuration(duration) {
        // Clear any existing timer
        if (this.blurTimer) {
            clearTimeout(this.blurTimer);
        }
        
        // Enable blur
        this.blurEnabled = true;
        
        // Set timer to disable blur after duration
        this.blurTimer = setTimeout(() => {
            this.blurEnabled = false;
            this.blurTimer = null;
        }, duration);
    }
    
    /**
     * Attempts to collect a nearby correct object
     * If near a wrong object instead, activates blur effect
     * Removes the closest correct object from the scene and moves it to the collected array
     */
    tryCollectNearbyObject() {
        const nearbyCorrectObjects = this.getNearbyCorrectObjects();
        const nearbyWrongObjects = this.getNearbyWrongObjects();
        
        // Priority: If there's a correct object nearby, collect it (ignore wrong objects)
        if (nearbyCorrectObjects.length > 0) {
            // Find the closest correct object
            const playerPos = this.transform.translation;
            let closestObject = nearbyCorrectObjects[0];
            let closestDistance = Infinity;
            
            for (const entity of nearbyCorrectObjects) {
                const objPos = entity.transform.translation;
                const dx = objPos[0] - playerPos[0];
                const dy = objPos[1] - playerPos[1];
                const dz = objPos[2] - playerPos[2];
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestObject = entity;
                }
            }
            
            // Remove from correct array
            const correctIndex = this.correct.indexOf(closestObject);
            if (correctIndex > -1) {
                this.correct.splice(correctIndex, 1);
                // Also remove from correct_name at same index
                if (correctIndex < this.correct_name.length) {
                    this.correct_name.splice(correctIndex, 1);
                }
            }
            
            // Also check and remove from wrong array (safety check)
            const wrongIndex = this.wrong.indexOf(closestObject);
            if (wrongIndex > -1) {
                this.wrong.splice(wrongIndex, 1);
            }
            
            // Remove all entities of this object from scene
            if (closestObject.entities) {
                for (const entity of closestObject.entities) {
                    const sceneIndex = this.scene.entities.indexOf(entity);
                    if (sceneIndex > -1) {
                        this.scene.entities.splice(sceneIndex, 1);
                    }
                }
            } else {
                // Fallback for single entity objects
                const sceneIndex = this.scene.entities.indexOf(closestObject);
                if (sceneIndex > -1) {
                    this.scene.entities.splice(sceneIndex, 1);
                }
            }
            
            // Add to collected array
            this.collected.push(closestObject);
            
            // Verify array integrity
            this.verifyArrayIntegrity();
            return;
        }
        
        // If no correct objects but there's a wrong object nearby, activate blur
        if (nearbyWrongObjects.length > 0) {
            this.activateBlurForDuration(5000); // 5 seconds
            return;
        }
        
        // Nothing nearby, do nothing
    }
    /**
     * Removes an object from the collected array and both correct/wrong arrays
     * Ensures no object exists in multiple arrays
     */
    removeObjectFromAllArrays(objectWrapper) {
        // Remove from correct
        const correctIndex = this.correct.indexOf(objectWrapper);
        if (correctIndex > -1) {
            this.correct.splice(correctIndex, 1);
            if (this.correct_name[correctIndex]) {
                this.correct_name.splice(correctIndex, 1);
            }
        }
        
        // Remove from wrong
        const wrongIndex = this.wrong.indexOf(objectWrapper);
        if (wrongIndex > -1) {
            this.wrong.splice(wrongIndex, 1);
        }
        
        // Remove from collected
        const collectedIndex = this.collected.indexOf(objectWrapper);
        if (collectedIndex > -1) {
            this.collected.splice(collectedIndex, 1);
        }
    }
    
    /**
     * Verifies that no object exists in multiple arrays
     * Returns true if all arrays are clean, false if duplicates found
     */
    verifyArrayIntegrity() {
        const pathsSeen = new Set();
        let hasDuplicates = false;
        
        // Check correct array
        for (const obj of this.correct) {
            if (pathsSeen.has(obj.objectType)) {
                hasDuplicates = true;
            }
            pathsSeen.add(obj.objectType);
        }
        
        // Check wrong array
        for (const obj of this.wrong) {
            if (pathsSeen.has(obj.objectType)) {
                hasDuplicates = true;
            }
            pathsSeen.add(obj.objectType);
        }
        
        // Check collected array
        for (const obj of this.collected) {
            if (pathsSeen.has(obj.objectType)) {
                hasDuplicates = true;
            }
            pathsSeen.add(obj.objectType);
        }
        
        return !hasDuplicates;
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
