import { vec3 } from "../../lib/glm.js";


export class FloorPhysics {
    
    constructor() {
        this.floorMesh = null;  //will hold all floor triangles in world space
        this.floorHeight = 10;   //fallback floor height if no collision mesh exists
    }

    //build floor collision mesh from a GLTF entity (or array of entities)
    setFloorCollision(entities) {
        const ents = Array.isArray(entities) ? entities : [entities];   //normalize input to an array
        const triangles = [];

        for (const entity of ents) {
            const modelMatrix = entity.modelMatrix || entity.modelMatrix;  //world transform of this entity
            for (const primitive of entity.primitives) {
                const positions = primitive.mesh.positions;
                const indices = primitive.mesh.indices;

                if (!positions) continue;

                //indexed geometry  (koti/ogljišča)
                if (indices && indices.length > 0) {
                    for (let i = 0; i < indices.length; i += 3) {  //triangle has 3 indices, we move for 3
                        const ia = indices[i] * 3;
                        const ib = indices[i + 1] * 3;
                        const ic = indices[i + 2] * 3;

                        //extract triange vertices
                        const a = vec3.fromValues(positions[ia], positions[ia + 1], positions[ia + 2]);
                        const b = vec3.fromValues(positions[ib], positions[ib + 1], positions[ib + 2]);
                        const c = vec3.fromValues(positions[ic], positions[ic + 1], positions[ic + 2]);

                        //model space to world space
                        vec3.transformMat4(a, a, modelMatrix);
                        vec3.transformMat4(b, b, modelMatrix);
                        vec3.transformMat4(c, c, modelMatrix);

                        triangles.push([a, b, c]);
                    }
                } else {
                    //assume triangles in sequence, positions are already laid out as triangles not vertices of a triangle
                    for (let i = 0; i < positions.length; i += 9) {
                        const a = vec3.fromValues(positions[i], positions[i + 1], positions[i + 2]);
                        const b = vec3.fromValues(positions[i + 3], positions[i + 4], positions[i + 5]);
                        const c = vec3.fromValues(positions[i + 6], positions[i + 7], positions[i + 8]);

                        vec3.transformMat4(a, a, modelMatrix);
                        vec3.transformMat4(b, b, modelMatrix);
                        vec3.transformMat4(c, c, modelMatrix);

                        triangles.push([a, b, c]);
                    }
                }
            }
        }

        this.floorMesh = { triangles };  //save collision mesh
    }


    // Moller-Trumbore ray-triangle intersection. Returns distance t or null.
    rayIntersectTriangle(orig, dir, v0, v1, v2) {
        const EPSILON = 1e-6;

        //triangle enges
        const edge1 = vec3.create();
        const edge2 = vec3.create();
        vec3.sub(edge1, v1, v0);
        vec3.sub(edge2, v2, v0);

        const pvec = vec3.create();  //calculate determinant
        vec3.cross(pvec, dir, edge2);

        const det = vec3.dot(edge1, pvec);
        if (det > -EPSILON && det < EPSILON) return null;   //ray is parallel to triangle, return null
        const invDet = 1.0 / det;

        const tvec = vec3.create();  //distance from v0 to ray origin
        vec3.sub(tvec, orig, v0);
        
        //barycentric V and U coordinate, does the ray hit a point inside the triangle? If 0 or 1 it's on the edge itself, bigger or smaller is outside the triangle
        const u = vec3.dot(tvec, pvec) * invDet;
        if (u < 0 || u > 1) return null;

        const qvec = vec3.create();
        vec3.cross(qvec, tvec, edge1);

        const v = vec3.dot(dir, qvec) * invDet;
        if (v < 0 || u + v > 1) return null;

        const t = vec3.dot(edge2, qvec) * invDet;  //distance along ray, valid hit if infront of ray origin, smaller then epsilon
        //returns distance t along ray or null if no hit
        if (t > EPSILON) return t;
        return null;
    }



    // Get floor height (y) at world X,Z by raycasting down from above with rayIntersectTriangle()
    getFloorHeightAt(x, z) {
        if (!this.floorMesh || !this.floorMesh.triangles || this.floorMesh.triangles.length === 0) {
            return this.floorHeight;
        }  //if no collision mesh return default height

        const origin = vec3.fromValues(x, 1000.0, z);  //ray origin high above the scene
        const dir = vec3.fromValues(0, -1, 0);  //ray direction straight down

        let closestT = Infinity;
        let hitY = null;

        //testing ray for every triangle
        for (const tri of this.floorMesh.triangles) {
            const t = this.rayIntersectTriangle(origin, dir, tri[0], tri[1], tri[2]);
            if (t !== null && t < closestT) {
                closestT = t;  //track closest hit
                hitY = origin[1] + dir[1] * t;
            }
        }

        if (hitY === null) return this.floorHeight;  //if no hit return default height
        return hitY;
    }

}