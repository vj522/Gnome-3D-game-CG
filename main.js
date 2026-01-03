// Main entry point for the game
import { WebGPURenderer } from './WebGPURenderer.js';
import { GLTFLoader } from './engine/loaders/GLTFLoader.js';
import { Game } from './Game.js';

import { Transform } from './engine/core/Transform.js';
import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from './engine/core/MeshUtils.js';


async function main() {
    const canvas = document.getElementById('glCanvas');
    const loadingDiv = document.getElementById('loading');
    
    // Initialize WebGPU
    if (!navigator.gpu) {
        alert('WebGPU is not supported in your browser! Please use Chrome 113+ or Edge 113+');
        return;
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        alert('Failed to get WebGPU adapter!');
        return;
    }
    
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    
    console.log('WebGPU initialized successfully');
    
    let game = null;
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (game && game.renderer) {
            game.renderer.resizePostProcessing(canvas.width, canvas.height);
            game.handleResize();
        }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load shader source files
    async function loadShaderSource(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${url}`);
        }
        return await response.text();
    }
    
    // Function to shuffle array
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    // Function to place object at position (defined at module level for Transform access)
    async function placeObjectAt(game, renderer, path, x, y, z) {
        try {
            // Check if this object path is already loaded to prevent duplicates
            const pathInCorrect = game.correct_name.includes(path);
            const pathInWrong = game.wrong.some(obj => obj.objectType === path);
            
            if (pathInCorrect || pathInWrong) {
                return; // Skip if already loaded
            }
            
            const objLoader = new GLTFLoader();
            const objData = await objLoader.load(path);
            
            // Ensure meshes have vertices arrays populated
            game.changeToVec(objData.entities);
            
            // Snap to ground at this XZ
            const floorY = game.floorPhysics.getFloorHeightAt(x, z);
            const yOnGround = floorY;

            // Compute model's local bottom (minY) across all primitives to correct for pivot
            let minYLocal = Infinity;
            for (const entity of objData.entities) {
                if (!entity.primitives) continue;
                for (const primitive of entity.primitives) {
                    const mesh = primitive && primitive.mesh;
                    if (!mesh || !mesh.vertices || mesh.vertices.length === 0) continue;
                    const aabb = calculateAxisAlignedBoundingBox(mesh);
                    if (aabb && aabb.min && aabb.min[1] < minYLocal) minYLocal = aabb.min[1];
                }
            }
            if (!isFinite(minYLocal)) minYLocal = 0;

            // Scale overrides: 'flower' 5x smaller, 'strawberry' 10x smaller
            const isFlower = path.includes('/flower/scene.gltf');
            const isStrawberry = path.includes('/strawberry/scene.gltf');
            const uniformScale = isStrawberry ? 0.01 : (isFlower ? 0.02 : 0.1);
            const groundedY = yOnGround - minYLocal * uniformScale;
            
            for (const entity of objData.entities) {
                const transform = new Transform({
                    translation: [x, groundedY, z],
                    rotation: [0, 0, 0, 1],
                    scale: [uniformScale, uniformScale, uniformScale]
                });
                entity.transform = transform;
                entity.modelMatrix = transform.matrix;
                
                // Mark entity with object type for tracking
                entity.objectType = path;
                entity.isCollectable = true; // Mark as a collectable object
            }
            
            game.addEntities(objData.entities);
            
            // Create a wrapper object that groups all entities as one logical object
            const objectWrapper = {
                entities: objData.entities,
                objectType: path,
                transform: objData.entities[0] ? objData.entities[0].transform : null,
                isCollectable: true
            };
            
            // Track object as a single unit in appropriate array
            game.objectCount++;
            
            if (game.objectCount <= 3) {
                game.correct.push(objectWrapper);
                game.correct_name.push(path);
            } else {
                game.wrong.push(objectWrapper);
            }
            
            // Preload textures for this object
            const tempScene = { entities: objData.entities };
            await renderer.preloadTextures(tempScene);
            
            console.log(`Placed object from ${path} at (${x}, ${y}, ${z})`);
        } catch (error) {
            console.error(`Failed to load object at ${path}:`, error);
        }
    }
    
    try {
        // Load and create shader modules
        console.log('Loading shaders...');
        const mainShaderSource = await loadShaderSource('shaders/main.wgsl');
        const postProcessShaderSource = await loadShaderSource('shaders/postprocess.wgsl');
        
        const mainShaderModule = device.createShaderModule({
            code: mainShaderSource
        });
        
        const postProcessShaderModule = device.createShaderModule({
            code: postProcessShaderSource
        });
        
        console.log('Shaders loaded successfully');
        
        // loadingDiv.textContent = 'Loading game';


        // Create renderer
        const renderer = new WebGPURenderer(device, context, canvas, mainShaderModule, postProcessShaderModule);
        console.log('Renderer created');
        
        // Create game
        game = new Game(canvas, renderer);
        await game.init_scene();
        console.log('Game created');
        

        
        //di vidim kako se narišejo boxi, potem to ven!!
        // game.scene.addEntities(gltfDataBox.entities);

        // console.log(gltfData.entities);
        

        console.log(`Added ${gltfData.entities.length} entities (forest) to scene`);

        // Add random objects at specified coordinates
        const coordinates = [
            { x: 8.35,  y: 28.22, z: -14.89 },
            { x: 15.02, y: 25.80, z: 11.86 },
            { x: 7.74,  y: 26.60, z: -5.82 },
            { x: -13.25, y: 26.94, z: 8.18 },
            { x: -11.97, y: 26.82, z: -3.27 },
            { x: -16.33, y: 27.20, z: -2.32 },
            { x: -11.30, y: 28.65, z: -18.46 },
            { x: -4.41,  y: 28.34, z: -19.89 }
        ];

        const objectPaths = [
            'objekti/flower/scene.gltf',
            'objekti/flowers/scene.gltf',
            'objekti/strawberry/scene.gltf',
            'objekti/crystal_stone_rock/scene.gltf',
            'objekti/berries/scene.gltf'
        ];

        // Load all random objects
        (async () => {
            // Create a copy of objectPaths and shuffle it to ensure variety
            const availableObjectPaths = shuffleArray(objectPaths);
            let objectPathIndex = 0;
            
            // Randomly select 5 out of 8 coordinates for placement
            const shuffledCoordinates = shuffleArray(coordinates).slice(0, 5);
            
            // Place first 3 objects in the correct array at random coordinates
            const firstThreeCoords = shuffledCoordinates.slice(0, 3);
            for (let i = 0; i < firstThreeCoords.length && objectPathIndex < availableObjectPaths.length; i++) {
                const coord = firstThreeCoords[i];
                const objectPath = availableObjectPaths[objectPathIndex];
                await placeObjectAt(game, renderer, objectPath, coord.x, coord.y, coord.z);
                objectPathIndex++;
            }
            
            // Place remaining objects at remaining coordinates
            const remainingCoords = shuffledCoordinates.slice(3);
            for (const coord of remainingCoords) {
                if (objectPathIndex < availableObjectPaths.length) {
                    const objectPath = availableObjectPaths[objectPathIndex];
                    await placeObjectAt(game, renderer, objectPath, coord.x, coord.y, coord.z);
                    objectPathIndex++;
                }
            }
            
            // Place the 6th object at player spawn location (if we have a 6th unique object)
            if (objectPathIndex < availableObjectPaths.length) {
                const playerSpawnObjectPath = availableObjectPaths[objectPathIndex];
                await placeObjectAt(game, renderer, playerSpawnObjectPath, 0, 30.0, 0);
            }
        })();


        
        // Preload textures
        loadingDiv.textContent = 'Loading textures...';
        await renderer.preloadTextures(game.scene);
        console.log('Textures preloaded');
        
        // Hide loading screen
        loadingDiv.style.display = 'none';
        
        // Debug: Log all arrays after game setup
        
        // Verify no objects exist in multiple arrays
        game.verifyArrayIntegrity();
        
        // Function to update correct-names display
        function updateCorrectNamesDisplay() {
            const list = document.getElementById('correct-names-list');
            list.innerHTML = '';
            for (const name of game.correct_name) {
                const li = document.createElement('li');
                // Extract just the object folder name from the path
                const objectName = name.split('/')[1] || name;
                li.textContent = objectName;
                list.appendChild(li);
            }
        }
        
        // Initial display update
        updateCorrectNamesDisplay();
        
        // Override tryCollectNearbyObject to update display when objects are collected
        const originalTryCollect = game.tryCollectNearbyObject.bind(game);
        game.tryCollectNearbyObject = function() {
            originalTryCollect();
            updateCorrectNamesDisplay();
        };
        
        // Render loop
        let lastTime = 0;


        function render(currentTime) {
            currentTime *= 0.001; // Convert to seconds
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            // Update game state
            if (deltaTime > 0 && deltaTime < 0.1) { // Cap delta time to avoid huge jumps
                game.update(deltaTime);
            }
            
            // Render the scene
            game.render();
            
            // Request next frame
            requestAnimationFrame(render);
        }
        
        // Start render loop
        requestAnimationFrame(render);
        
        console.log('Game started successfully! You should see the forest.');
        console.log('Click on the canvas to lock pointer and use WASD to move, mouse to look around.');
        
    } catch (error) {
        console.error('Error initializing game:', error);
        loadingDiv.textContent = 'Error: ' + error.message;
        loadingDiv.style.color = 'red';
    }
}

// Start the application
main();
