// Main entry point for the game
import { WebGPURenderer } from './WebGPURenderer.js';
import { Game } from './Game.js';
import { GLTFLoader } from './engine/loaders/GLTFLoader.js';

import { Transform } from './engine/core/Transform.js';
import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from './engine/core/MeshUtils.js';


export async function main(canvas) {

    // const canvas = document.getElementById('glCanvas');
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
    let pendingWinTimeout = null;
    
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
                console.log(`Skipping duplicate object: ${path}`);
                return; // Skip if already loaded
            }
            
            const objLoader = new GLTFLoader();
            const objData = await objLoader.load(path);
            
            // Ensure meshes have vertices arrays populated
            game.scene.changeToVec(objData.entities);
            
            // Snap to ground at this XZ
            const floorY = game.scene.floorPhysics.getFloorHeightAt(x, z);
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
            const isStrawberry = path.includes('/strawberry/strawberry.gltf');
            const uniformScale = isStrawberry ? 1 : (isFlower ? 0.02 : 0.1);
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
            
            // Add to current scene
            game.scene.addEntities(objData.entities);
            
            // Also add to the other scene so objects appear in both forest and cave
            const otherScene = game.scene === game.forestScene ? game.caveScene : game.forestScene;
            if (otherScene) {
                otherScene.addEntities(objData.entities);
            }
            
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
        
        loadingDiv.textContent = 'Loading game';


        // Create renderer
        const renderer = new WebGPURenderer(device, context, canvas, mainShaderModule, postProcessShaderModule);
        console.log('Renderer created');
        
        // Create game
        game = new Game(canvas, renderer);
        window.gameInstance = game; // Store for restart purposes
        await game.init_scene();
        console.log('Game created');

    async function spawnGameObjects() {
        // Add random objects at specified coordinates
        const coordinates = [
            { x: 8.35,  y: 28.22, z: -14.89 },
            { x: 15.02, y: 25.80, z: 11.86 },
            { x: 7.74,  y: 26.60, z: -5.82 },
            { x: -13.25, y: 26.94, z: 8.18 },
            { x: -11.97, y: 26.82, z: -3.27 },
            { x: -16.33, y: 27.20, z: -2.32 },
            { x: -11.30, y: 28.65, z: -18.46 },
            { x: -4.41,  y: 28.34, z: -19.89 },
        ];

        const objectPaths = [
            'objekti/flower/scene.gltf',
            'objekti/strawberry/strawberry.gltf',
            'objekti/rock/crystal_stone_rock.gltf',
            'objekti/berries/scene.gltf',
            'objekti/mushrooms/mushrooms.gltf'
        ];

        // Load all 5 unique objects - first 3 go to correct, remaining 2 go to wrong
        // Shuffle object paths to randomize which objects appear
        const shuffledObjectPaths = shuffleArray(objectPaths);
        
        // Randomly select 5 out of 8 coordinates for placement
        const shuffledCoordinates = shuffleArray(coordinates).slice(0, 6);
        
        // Place all 5 objects (each object path used exactly once)
        for (let i = 0; i < 5 && i < shuffledObjectPaths.length; i++) {
            const coord = shuffledCoordinates[i];
            const objectPath = shuffledObjectPaths[i];
            await placeObjectAt(game, renderer, objectPath, coord.x, coord.y, coord.z);
            console.log(`Placed object ${i + 1}/5: ${objectPath} at (${coord.x}, ${coord.y}, ${coord.z})`);
        }
        
        console.log(`Objects spawned - Correct: ${game.correct.length}, Wrong: ${game.wrong.length}`);
    }
    
    // Spawn objects initially
    await spawnGameObjects();

        
        // Preload textures
        // loadingDiv.textContent = 'Loading textures...';
        await renderer.preloadTextures(game.scene);
        console.log('Textures preloaded');
        
        // Hide loading screen
        loadingDiv.style.display = 'none';
        
        // Make spawnGameObjects available globally for restarts
        window.spawnGameObjects = spawnGameObjects;
        
        // Verify no objects exist in multiple arrays
        game.verifyArrayIntegrity();
        

        // Map object paths (or folder names) to emojis
        const objectEmojiMap = {
            'flower': '🌹',
            'strawberry': '🍓',
            'rock': '🪨',
            'berries': '🍒',
            'mushrooms': '🍄'
        };

        function updateCorrectEmojiDisplay() {
            const emojiBox = document.getElementById('correct-emojis');
            emojiBox.innerHTML = ''; // Clear previous emojis

            for (const path of game.correct_name) {
                // Extract folder name from path
                const folderName = path.split('/')[1] || path;

                // Lookup emoji
                const emoji = objectEmojiMap[folderName] || '❓';

                // Create a span for each emoji
                const span = document.createElement('span');
                span.textContent = emoji;
                emojiBox.appendChild(span);
            }
        }

        

        // Override tryCollectNearbyObject to update display when objects are collected
        const originalTryCollect = game.tryCollectNearbyObject.bind(game);
        game.tryCollectNearbyObject = function() {

            originalTryCollect();

            updateCorrectEmojiDisplay(); // update emojis instead of names

            if (game.correct.length === 0){
                // Delay end screen to let pickup animation finish
                if (pendingWinTimeout) {
                    clearTimeout(pendingWinTimeout);
                }
                pendingWinTimeout = setTimeout(() => {
                    window.showWin();
                }, 1500); // 1.5s delay before showing end screen
            }
        };

        
        // Initial display update
        updateCorrectEmojiDisplay();
        
        // Make updateCorrectEmojiDisplay available globally for restarts
        window.updateCorrectEmojiDisplay = updateCorrectEmojiDisplay;


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
