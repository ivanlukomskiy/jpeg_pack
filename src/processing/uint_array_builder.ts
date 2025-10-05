export class Uint8ArrayBuilder {
    private buffer: Uint8Array;
    private currentByte: number = 0;
    private bitPosition: number = 0;
    private bytePosition: number = 0;

    constructor(lengthInBytes: number) {
        this.buffer = new Uint8Array(lengthInBytes);
    }
    addBit(bit: number): void {
        if (bit !== 0 && bit !== 1) {
            throw new Error('Bit must be 0 or 1');
        }

        if (this.bytePosition >= this.buffer.length) {
            throw new Error('Buffer overflow');
        }
        this.currentByte |= (bit << (7 - this.bitPosition));
        this.bitPosition++;
        if (this.bitPosition === 8) {
            this.buffer[this.bytePosition] = this.currentByte;
            this.bytePosition++;
            this.currentByte = 0;
            this.bitPosition = 0;
        }
    }
    toUint8Array(): Uint8Array {
        if (this.bitPosition > 0) {
            this.buffer[this.bytePosition] = this.currentByte;
        }

        const effectiveLength = this.bitPosition > 0 ? this.bytePosition + 1 : this.bytePosition;
        return this.buffer.slice(0, effectiveLength);
    }
}