// Main entry point for the game
import { WebGPURenderer } from './WebGPURenderer.js';
import { GLTFLoader } from './engine/loaders/GLTFLoader.js';
import { Game } from './Game.js';



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
        const mainShaderSource = await loadShaderSource('shaders/main.wgsl');
        const postProcessShaderSource = await loadShaderSource('shaders/postprocess.wgsl');
        
        const mainShaderModule = device.createShaderModule({
            code: mainShaderSource
        });
        
        const postProcessShaderModule = device.createShaderModule({
            code: postProcessShaderSource
        });
        
        
        // loadingDiv.textContent = 'Loading game';


        // Create renderer
        const renderer = new WebGPURenderer(device, context, canvas, mainShaderModule, postProcessShaderModule);
        
        // Create game
        game = new Game(canvas, renderer);
        await game.init_scene();
        

        
        //di vidim kako se narišejo boxi, potem to ven!!
        // game.scene.addEntities(gltfDataBox.entities);

        // console.log(gltfData.entities);
        


        
        // Preload textures
        loadingDiv.textContent = 'Loading textures...';
        await renderer.preloadTextures(game.scene);
        
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
        
        // Game initialized
        
    } catch (error) {
        console.error('Error initializing game:', error);
        loadingDiv.textContent = 'Error: ' + error.message;
        loadingDiv.style.color = 'red';
    }
}

// Start the application
main();
