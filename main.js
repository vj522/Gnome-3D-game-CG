// Main entry point for the game
import { WebGPURenderer } from './WebGPURenderer.js';
import { GLTFLoader } from './engine/loaders/GLTFLoader.js';
import { Game } from './Game.js';
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
        
        // Create renderer
        const renderer = new WebGPURenderer(device, context, canvas, mainShaderModule, postProcessShaderModule);
        console.log('Renderer created');
        
        // Create game
        game = new Game(canvas, renderer);
        console.log('Game created');
        
        // Load GLTF model
        loadingDiv.textContent = 'Loading forest model...';
        const loader = new GLTFLoader();
        // const gltfData = await loader.load('objekti/hand_painted_forest/hand_painted_forest.gltf');
        const gltfData = await loader.load('objekti/collisions_test/forest_final.gltf');
        console.log('GLTF model loaded');

        const loaderBox = new GLTFLoader();
        const gltfDataBox = await loaderBox.load('objekti/collision_boxes2/map_with_boxes.gltf');
        console.log('GLTF model loaded');
        
        // Add all entities from GLTF to the scene
        
        game.changeToVec(gltfData.entities);
        game.addTransform(gltfData.entities);
        game.addEntities(gltfData.entities);

        
        game.changeToVec(gltfDataBox.entities);
        game.addTransform(gltfDataBox.entities);
        game.addEntitiesBox(gltfDataBox.entities);

        //di vifim kako se narišejo boxi, potem to ven!!
        game.addEntities(gltfDataBox.entities);

        // console.log(gltfData.entities);
        
        console.log(`Added ${gltfData.entities.length} entities to scene`);

        
        for (const entity of game.collisions.entities) {
            // console.log(entity)

            const boxes = entity.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
            entity.aabb = mergeAxisAlignedBoundingBoxes(boxes);
        }
        
        // Preload textures
        loadingDiv.textContent = 'Loading textures...';
        await renderer.preloadTextures(game.scene);
        console.log('Textures preloaded');
        
        // Hide loading screen
        loadingDiv.style.display = 'none';
        
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
