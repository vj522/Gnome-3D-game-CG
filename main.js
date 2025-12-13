// Main entry point for the game
import { Renderer } from './Renderer.js';
import { GLTFLoader } from './GLTFLoader.js';
import { Game } from './Game.js';

async function main() {
    const canvas = document.getElementById('glCanvas');
    const loadingDiv = document.getElementById('loading');
    
    // Initialize WebGL2
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        alert('WebGL2 is not supported in your browser!');
        return;
    }
    
    console.log('WebGL2 initialized successfully');
    
    let game = null;
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (game) {
            game.handleResize();
        }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Enable depth testing and backface culling
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    
    // Load shader source files
    async function loadShaderSource(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${url}`);
        }
        return await response.text();
    }
    
    // Compile shader
    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${info}`);
        }
        
        return shader;
    }
    
    // Create shader program
    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program linking error: ${info}`);
        }
        
        return program;
    }
    
    try {
        // Load and compile shaders
        console.log('Loading shaders...');
        const vertexSource = await loadShaderSource('shaders/vertex.glsl');
        const fragmentSource = await loadShaderSource('shaders/fragment.glsl');
        
        const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
        
        const shaderProgram = createProgram(gl, vertexShader, fragmentShader);
        console.log('Shaders compiled successfully');
        
        // Load and compile post-processing shaders
        console.log('Loading post-processing shaders...');
        const postVertexSource = await loadShaderSource('shaders/postprocess_vertex.glsl');
        const postFragmentSource = await loadShaderSource('shaders/postprocess.glsl');
        
        const postVertexShader = compileShader(gl, postVertexSource, gl.VERTEX_SHADER);
        const postFragmentShader = compileShader(gl, postFragmentSource, gl.FRAGMENT_SHADER);
        
        const postProcessProgram = createProgram(gl, postVertexShader, postFragmentShader);
        console.log('Post-processing shaders compiled successfully');
        
        // Create renderer
        const renderer = new Renderer(gl, shaderProgram, postProcessProgram);
        console.log('Renderer created');
        
        // Create game
        game = new Game(canvas, renderer);
        console.log('Game created');
        
        // Load GLTF model
        loadingDiv.textContent = 'Loading forest model...';
        const loader = new GLTFLoader();
        const gltfData = await loader.load('objekti/hand_painted_forest/hand_painted_forest.gltf');
        console.log('GLTF model loaded');
        
        // Add all entities from GLTF to the scene
        game.addEntities(gltfData.entities);
        console.log(`Added ${gltfData.entities.length} entities to scene`);
        
        // Hide loading screen
        loadingDiv.style.display = 'none';
        
        // Render loop
        let lastTime = 0;
        function render(currentTime) {
            currentTime *= 0.001; // Convert to seconds
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            // Clear the canvas
            gl.clearColor(0.5, 0.6, 0.7, 1.0); // Sky blue color
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
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
