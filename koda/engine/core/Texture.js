//hrani texture ki se nanesejo na mesh objekta

export class Texture {

    constructor({
        image,  //vsebuje teksturo
        sampler, //kako se bere (nearest, ponavljanje..)
        isSRGB = false,  //true se uporabčja sRGB, vpliva na osvetljevanje
    } = {}) {
        this.image = image;
        this.sampler = sampler;
        this.isSRGB = isSRGB;
    }

    get width() {
        return this.image.width;
    }

    get height() {
        return this.image.height;
    }

}
