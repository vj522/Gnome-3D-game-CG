import { mat4, vec3, quat } from './lib/glm.js';
import { Camera } from './engine/core/Camera.js'
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { Transform } from './engine/core/Transform.js';

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
            velocity: [0, 0, 0],
            acceleration: 20,
            maxSpeed: 8,
            decay: 0.99999,
            pointerSensitivity: 0.002,
        });
        

        // // Jump mechanics
        // this.gravity = -20.0; // Gravity acceleration
        // this.jumpVelocity = 15.0; // Initial jump velocity (increased for higher jumps)
        this.gravity = null;
        this.jumpVelocity = null;
        this.isOnGround = true;
        
        // Torch light toggle (Shift key) - ONLY in Cave
        this.torchLightEnabled = false;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift' && this.scene.name === 'Cave') {
                this.torchLightEnabled = !this.torchLightEnabled; // Toggle
            }
        });

        // Visual effects
        this.blurEnabled = false;
        this.bloomEnabled = false;
        
        // Pickup light (tied to object position during pickup)
        this.pickupLightIntensity = 0.0; // 0 = off, 1 = full intensity
        this.pickupLightPos = [0, 0, 0];

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
        this.collectionRadius = 4; // Radius for nearby object detection
        
        // Blur effect timer
        this.blurTimer = null; // Timer for temporary blur effect

        //scenes
        this.forestScene = null;
        this.caveScene = null;
        this.scene = null; 
        this.sceneNameDiv = document.getElementById('sceneName');


        // Add key handler for blur toggle
        document.addEventListener('keydown', (e) => {
            // Blur toggle (Digit8)
            if (e.code === 'Digit8') {
                this.blurEnabled = !this.blurEnabled;
                console.log('Blur effect:', this.blurEnabled ? 'ON' : 'OFF');
            }
            // Collect objects (E)
            if (e.code === 'KeyE') {
                this.tryCollectNearbyObject();
            }
        });
   
    }

    async init_scene(){
        //load scene (forest), later switch to cave
        this.forestScene = new ForestScene(this);
        this.caveScene = new CaveScene(this);
        this.caveScene.initTargetScene(this.forestScene);
        this.forestScene.initTargetScene(this.caveScene);
        //we start in a forest
        this.scene = this.forestScene;
        // this.scene=this.caveScene;
        this.sceneNameDiv.textContent = this.scene.name;
        this.gravity = -20.0; // Gravity acceleration
        this.jumpVelocity = 15.0;
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
        
        for (const objectWrapper of this.correct) {
            // objectWrapper has { entities: [...], transform: firstEntity.transform, ... }
            if (!objectWrapper.transform) continue;
            
            const objPos = objectWrapper.transform.translation;
            const dx = objPos[0] - playerPos[0];
            const dy = objPos[1] - playerPos[1];
            const dz = objPos[2] - playerPos[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance <= this.collectionRadius) {
                nearbyObjects.push(objectWrapper);
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
            
            // Animate object lifting up before removing
            const pickupAnimation = (closestObject) => {
                // Get current position
                const entities = closestObject.entities || [closestObject];
                
                // Create lift animation (rise slowly, pause at top)
                const liftHeight = 1.5;
                const animationDuration = 3200;
                const startTime = performance.now();
                
                // Store animation data on each entity
                for (const entity of entities) {
                    if (entity.transform) {
                        entity.pickupAnimation = {
                            startPos: [...entity.transform.translation],
                            liftHeight: liftHeight,
                            startTime: startTime,
                            duration: animationDuration,
                        };
                    }
                }
                
                // Remove from scene after animation completes
                setTimeout(() => {
                    for (const entity of entities) {
                        delete entity.pickupAnimation; // Clean up animation data
                        const sceneIndex = this.scene.entities.indexOf(entity);
                        if (sceneIndex > -1) {
                            this.scene.entities.splice(sceneIndex, 1);
                        }
                    }
                }, animationDuration);
            };
            
            pickupAnimation(closestObject);
            
            // Add to collected array
            this.collected.push(closestObject);
            
            // Enable halo flag for these entities
            for (const entity of closestObject.entities) {
                entity.showHalo = true; // mark them for halo
            }


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
        
        // Update pickup animations
        const currentTime = performance.now();
        let hasActivePickup = false;
        
        for (const entity of this.scene.entities) {
            if (entity.pickupAnimation) {
                const anim = entity.pickupAnimation;
                const elapsed = currentTime - anim.startTime;
                const progress = Math.min(elapsed / anim.duration, 1.0);
                
                // Custom easing: rise to top in 60% of time, pause at top for remaining 40%
                let easedProgress;
                let isAtTop = false;
                if (progress < 0.6) {
                    // Rising phase - ease out for smooth deceleration
                    const risingProgress = progress / 0.6;
                    easedProgress = 1 - Math.pow(1 - risingProgress, 2);
                } else {
                    // Pause phase - stay at top
                    easedProgress = 1.0;
                    isAtTop = true;
                }
                
                entity.transform.translation[1] = anim.startPos[1] + (anim.liftHeight * easedProgress);
                
                // Keep pickup light anchored to the object's current position
                this.pickupLightPos = [...entity.transform.translation];
                
                // Rotate object continuously during entire animation
                if (entity.primitives) {
                    const rotationSpeed = 0.02; // radians per frame
                    const yAxisRotation = quat.create();
                    quat.setAxisAngle(yAxisRotation, [0, 1, 0], rotationSpeed);
                    quat.multiply(entity.transform.rotation, yAxisRotation, entity.transform.rotation);
                }
                
                // Invalidate cached matrix to force recalculation
                entity.transform._matrixRaw = null;
                
                // Update modelMatrix (used by renderer)
                entity.modelMatrix = entity.transform.matrix;
                
                // Control pickup light: ramp up with progress, peak at top
                if (entity.primitives) {
                    hasActivePickup = true;
                    // Ramp from soft (2.5) to strong (6.0) as progress approaches 1
                    const base = 2.5;
                    const peak = 6.0;
                    const slowRamp = easedProgress * easedProgress; // ease-in to rise slower
                    this.pickupLightIntensity = base + (peak - base) * slowRamp;
                }
            }
        }
        
        // Disable light when no active pickup
        if (!hasActivePickup) {
            this.pickupLightIntensity = 0.0;
        }
        
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
            console.log("jump vel" + this.jumpVelocity);
        }

        //logging coordinates when moved
        const speed = Math.hypot(this.controller.velocity[0], this.controller.velocity[2]);
        // if (speed > 0.01) { // small threshold to avoid logging tiny movements
        //     console.log("Player coordinates:", this.transform.translation);
        //     console.log("Player rotation:", this.transform.rotation);
        // }

        
        //scene specific physics, resolve collisions with objects
        this.scene.physics.update(0, deltaTime);
        
        // Update scene-specific held items (torch in CaveScene follows camera)
        if (this.scene.updateHeldItems) {
            this.scene.updateHeldItems(this.transform, this.controller.velocity);
        }
        
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
        this.gravity = sceneInstance.sceneTrigger.gravity;
        this.jumpVelocity = sceneInstance.sceneTrigger.jumpVelocity;


        this.scene.sceneTrigger.triggered = true;

        this.transform.translation = newScene.targetPosition;
        this.controller.yaw = newScene.targetYaw;
        
        // Turn off torch light when changing scenes
        this.torchLightEnabled = false;

        this.sceneNameDiv.textContent = this.scene.name;


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
        this.renderer.render(this.scene, this.camera, this.blurEnabled, this.bloomEnabled, this.pickupLightIntensity, this.pickupLightPos, this.torchLightEnabled);
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
