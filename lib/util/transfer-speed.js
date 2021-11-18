const FifoArray = require("fifo-array");

module.exports = class TransferSpeed {
    constructor() {
        this.arr = new FifoArray(2, []);
    }

    _convertBytes(bytes) {
        if (bytes == 0) {
            return "n/a";
        }

        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        if (i == 0) {
            return bytes + " " + sizes[i];
        }

        return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
    }


    update(size) {
        this.arr.push({
            size: size,
            time: Date.now()
        });
    }

    getSpeed() {
        let speed = 0;

        if (this.arr.length == 2) {
            const oChunk = this.arr[0];
            const nChunk = this.arr[1];

            const timeDiff = nChunk.time - oChunk.time;
            const sizeDiff = nChunk.size - oChunk.size;

            speed = sizeDiff / timeDiff * 1000;
        } else {
            speed = this.arr[0].size;
        }

        return `${this._convertBytes(speed)}PS`;
    }
}