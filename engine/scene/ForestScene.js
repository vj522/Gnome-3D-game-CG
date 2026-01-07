import { mat4 } from "../../lib/glm.js";
import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js";
import { Transform } from "../core/Transform.js";
import { CaveScene } from "./CaveScene.js";
import { Mesh, Primitive, Material, Model, Vertex, Texture, Sampler } from "../core/core.js";
import { ImageLoader } from "../loaders/ImageLoader.js";



export class ForestScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.imageLoader = new ImageLoader();
        this.sceneTrigger = {
            bounds: {   min: [2, 10, -20],  
                        max: [4, 50, -17], },
            targetScene: null,
            targetPosition: [-18,12.2,-67],
            targetYaw: 3.14,
            triggered: false,
        };

        // Forest fog settings
        this.fog = {
            color: [0.45, 0.6, 0.45],  // Temno zelena megla
            density: 0.03
        };
    }

    async load() {

        const loadingDiv = document.getElementById('loading');

        // Load GLTF model
        loadingDiv.textContent = 'Loading forest model...';
        const gltfData = await this.loader.load('objekti/ForestScene/forest/forest.gltf');
        console.log('GLTF model loaded (forest)');

        this.changeToVec(gltfData.entities);
        this.addTransform(gltfData.entities);
        this.addEntities(gltfData.entities);


        //boxes za drevesa, stene, meje površine
        const gltfDataBox = await this.loader.load('objekti/ForestScene/wall/forest_all_boxes.gltf');
        console.log('GLTF model loaded (forest collisions)');

        this.changeToVec(gltfDataBox.entities);
        this.addTransform(gltfDataBox.entities);
        this.addEntitiesBox(gltfDataBox.entities);
        this.computeAABBs();

        // Load floor collision GLTF (single object with exact collision)
        const gltfDataFloor = await this.loader.load('objekti/ForestScene/floor/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

        // Naloži teksturo za meglene stene
        loadingDiv.textContent = 'Loading fog wall texture...';
        const fogWallImage = await this.imageLoader.load('objekti/fog_wall.jpg');
        console.log('Fog wall texture loaded');

        // Dodaj meglene stene okoli scene
        this.createFogWalls(fogWallImage);

    }

    createFogWalls(fogWallImage) {
        const wallHeight = 60;
        const wallSize = 80;
        const wallDistance = 22;  // Bližje modelu
        
        // Ustvari teksturo iz slike
        const fogTexture = new Texture({
            image: fogWallImage,
            sampler: new Sampler({
                minFilter: 'linear',
                magFilter: 'linear',
                addressModeU: 'repeat',
                addressModeV: 'repeat',
            }),
        });
        
        // Ustvarimo material s teksturo za stene
        const fogMaterial = new Material({
            baseTexture: fogTexture,
            baseFactor: [1.0, 1.0, 1.0, 1.0],
        });
        
        // Ustvarimo темно modro material samo za pokrov
        const roofMaterial = new Material({
            baseFactor: [0.1, 0.2, 0.4, 1.0],  // Temno modra
        });

        // Funkcija za ustvarjanje vertikalne ravnine
        const createWallMesh = () => {
            // Dodam dodatne vertexa na robovih za zaobljene kot
            const positions = new Float32Array([
                -wallSize/2, -10, 0,           // spodaj levo
                wallSize/2, -10, 0,            // spodaj desno
                wallSize/2, wallHeight, 0,     // zgoraj desno
                -wallSize/2, wallHeight, 0,    // zgoraj levo
            ]);
            
            const texCoords = new Float32Array([
                0, 1,
                1, 1,
                1, 0,
                0, 0,
            ]);
            
            // Normals za zaobljene robove - zgoraj so nakazani proti pokrovu
            const normals = new Float32Array([
                -0.7, 0, 0.7,     // spodaj levo - zaobljeno
                0.7, 0, 0.7,      // spodaj desno - zaobljeno
                0.7, -0.3, -0.7,  // zgoraj desno - zaobljeno proti pokrovu
                -0.7, -0.3, -0.7, // zgoraj levo - zaobljeno proti pokrovu
            ]);
            
            const indices = new Uint32Array([
                0, 1, 2,
                0, 2, 3
            ]);
            
            return {
                positions: positions,
                texCoords: texCoords,
                normals: normals,
                indices: indices,
            };
        };

        const fogWalls = [];
        
        // Severna stena (Z-)
        const northMatrix = mat4.create();
        mat4.translate(northMatrix, northMatrix, [0, 0, -wallDistance]);
        
        fogWalls.push({
            primitives: [new Primitive({
                mesh: createWallMesh(),
                material: fogMaterial,
            })],
            modelMatrix: northMatrix,
        });

        // Južna stena (Z+)
        const southMatrix = mat4.create();
        mat4.translate(southMatrix, southMatrix, [0, 0, wallDistance]);
        mat4.rotateY(southMatrix, southMatrix, Math.PI);
        
        fogWalls.push({
            primitives: [new Primitive({
                mesh: createWallMesh(),
                material: fogMaterial,
            })],
            modelMatrix: southMatrix,
        });

        // Vzhodna stena (X+)
        const eastMatrix = mat4.create();
        mat4.translate(eastMatrix, eastMatrix, [wallDistance, 0, 0]);
        mat4.rotateY(eastMatrix, eastMatrix, -Math.PI / 2);
        
        fogWalls.push({
            primitives: [new Primitive({
                mesh: createWallMesh(),
                material: fogMaterial,
            })],
            modelMatrix: eastMatrix,
        });

        // Zahodna stena (X-)
        const westMatrix = mat4.create();
        mat4.translate(westMatrix, westMatrix, [-wallDistance, 0, 0]);
        mat4.rotateY(westMatrix, westMatrix, Math.PI / 2);
        
        fogWalls.push({
            primitives: [new Primitive({
                mesh: createWallMesh(),
                material: fogMaterial,
            })],
            modelMatrix: westMatrix,
        });

        // Pokrov nad gozdom (stena na vrhu)
        const roofSize = wallSize;
        const roofY = wallHeight - 2;  // Malo nižje da se prekriva s stenami
        
        const createRoofMesh = () => {
            // Pokrov je malo večji da se lepše prekriva s stenami
            const roofPadding = wallSize * 0.15;
            const roofFullSize = roofSize + roofPadding;
            
            const positions = new Float32Array([
                -roofFullSize/2, 0, -roofFullSize/2,
                roofFullSize/2, 0, -roofFullSize/2,
                roofFullSize/2, 0, roofFullSize/2,
                -roofFullSize/2, 0, roofFullSize/2,
            ]);
            
            const texCoords = new Float32Array([
                0, 0,
                1, 0,
                1, 1,
                0, 1,
            ]);
            
            const normals = new Float32Array([
                0, -1, 0,
                0, -1, 0,
                0, -1, 0,
                0, -1, 0,
            ]);
            
            const indices = new Uint32Array([
                0, 1, 2,
                0, 2, 3
            ]);
            
            return {
                positions: positions,
                texCoords: texCoords,
                normals: normals,
                indices: indices,
            };
        };
        
        const roofMatrix = mat4.create();
        mat4.translate(roofMatrix, roofMatrix, [0, roofY, 0]);
        
        fogWalls.push({
            primitives: [new Primitive({
                mesh: createRoofMesh(),
                material: roofMaterial,  // Темно modri material
            })],
            modelMatrix: roofMatrix,
        });

        // Pretvori positions v vertices in dodaj transform
        this.changeToVec(fogWalls);
        this.addTransform(fogWalls);
        this.addEntities(fogWalls);
    }

}