//geometrija objekta, njogove točke

export class Mesh {

    constructor({
        vertices = [],
        indices = [],
    } = {}) {
        this.vertices = vertices;
        this.indices = indices;
    }

}