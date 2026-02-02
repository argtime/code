import { ChaosParams, CustomKey } from '../types';

const ARTIFACT_KEY = new Uint8Array([
    0x9A, 0xF2, 0x11, 0x0C, 0x44, 0x7B, 0x99, 0x2E,
    0x51, 0xCB, 0xD3, 0xEA, 0x88, 0x41, 0xFE, 0x05,
    0x19, 0xA2, 0x33, 0x77, 0xBB, 0xCC, 0xDD, 0xEE,
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11,
    0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0
]);

const SECONDARY_KEY = new Uint8Array([
    0x47, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45,
    0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45,
    0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
    0xF0, 0xDE, 0xBC, 0x9A, 0x78, 0x56, 0x34, 0x12,
    0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC,
    0xCC, 0xBB, 0xAA, 0x99, 0x88, 0x77, 0x66, 0x55,
    0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA, 0x99, 0x88
]);

const FORMAT_VERSION = 0x02;
const MAGIC_PREFIX = 0xCF;
const CUSTOM_KEY_MARKER = 0xF7;
const MIN_MESSAGE_SIZE = 1;
const MAX_MESSAGE_SIZE = 1024 * 1024;

const SBOX_CORE = new Uint8Array(256);
for(let i=0; i<256; i++) {
    let val = (i * 167 + 13) ^ (i * 223 + 47);
    val = ((val * 181 + 19) ^ (val * 251 + 73)) & 0xFF;
    SBOX_CORE[i] = val;
}

const HMAC_KEY = new Uint8Array(32);
for(let i=0; i<32; i++) {
    HMAC_KEY[i] = (ARTIFACT_KEY[i % ARTIFACT_KEY.length] ^ SECONDARY_KEY[i % SECONDARY_KEY.length]);
}

const DT = 0.005;
const BURNIN_ROUNDS = 1000;

class HyperVectorEngine {
    state: Float64Array;
    coeffs: Float64Array;
    private stateHash: number = 0;

    constructor(params: ChaosParams, salt: Uint8Array, customKey?: CustomKey) {
        this.state = new Float64Array(8);
        this.coeffs = new Float64Array(6);

        this.validateParams(params);

        this.state[0] = params.startX;
        this.state[1] = params.startY;
        this.state[2] = params.startZ;
        
        this.state[3] = -params.startY + 0.1 + Math.sin(params.startX);
        this.state[4] = params.startX - 0.1 + Math.cos(params.startY);
        this.state[5] = params.startZ / 2.0 + Math.tan(params.beta);
        
        this.state[6] = params.sigma * 0.01;
        this.state[7] = params.rho * 0.01;

        this.coeffs[0] = params.sigma;
        this.coeffs[1] = params.rho;
        this.coeffs[2] = params.beta;
        
        this.coeffs[3] = 0.2 + (params.sigma / 1000.0);
        this.coeffs[4] = 0.2 + (params.beta / 1000.0);
        this.coeffs[5] = 5.7 + (params.rho / 100.0);

        this.ingest(salt, customKey);
        this.computeStateHash();
    }

    private validateParams(params: ChaosParams): void {
        if (!isFinite(params.sigma) || !isFinite(params.rho) || !isFinite(params.beta)) {
            throw new Error("Invalid parameters: non-finite values detected");
        }
        if (params.sigma < 1 || params.rho < 1 || params.beta < 0.1) {
            throw new Error("Invalid parameters: out of acceptable range");
        }
    }

    private computeStateHash(): void {
        let hash = 0;
        for(let i = 0; i < this.state.length; i++) {
            hash = ((hash << 5) - hash + Math.floor(this.state[i] * 1000)) | 0;
        }
        this.stateHash = hash;
    }

    private ingest(salt: Uint8Array, customKey?: CustomKey) {
        for(let i=0; i<salt.length; i++) {
            const n = salt[i] / 255.0;
            this.state[0] += Math.sin(n * Math.PI);
            this.state[2] += Math.cos(n * Math.PI);
            this.state[3] -= Math.sin(n * Math.PI * 2);
            this.state[4] += Math.cos(n * Math.PI * 2);
            this.state[6] += n;
            this.state[7] -= n;
            this.cycle();
        }

        if (customKey) {
            for(let i=0; i<customKey.key.length; i++) {
                const k = customKey.key[i] / 255.0;
                this.state[0] *= (1.0 + k * 0.001);
                this.state[1] *= (1.0 - k * 0.001);
                this.state[2] += Math.atan(k);
                this.state[3] -= Math.asin(Math.min(k, 1.0));
                this.state[4] += Math.acos(Math.min(k, 1.0));
                this.state[5] *= (1.0 + k * 0.002);
                this.cycle();
            }
        }

        for(let i=0; i<BURNIN_ROUNDS; i++) this.cycle();
        this.computeStateHash();
    }

    cycle(): void {
        const s = this.state;
        const c = this.coeffs;

        const d0 = c[0] * (s[1] - s[0]) * DT + s[6] * 0.0001;
        const d1 = (s[0] * (c[1] - s[2]) - s[1]) * DT + s[7] * 0.0001;
        const d2 = (s[0] * s[1] - c[2] * s[2]) * DT;

        const d3 = (-(s[4]) - s[5] + (s[0] * 0.01)) * DT; 
        const d4 = (s[3] + c[3] * s[4] + s[6] * 0.0001) * DT;
        const d5 = (c[4] + s[5] * (s[3] - c[5]) + s[7] * 0.0001) * DT;

        const d6 = (s[0] * s[3] - s[6] * c[0]) * 0.0001 * DT;
        const d7 = (s[1] * s[4] - s[7] * c[1]) * 0.0001 * DT;

        s[0] += d0; s[1] += d1; s[2] += d2;
        s[3] += d3; s[4] += d4; s[5] += d5;
        s[6] += d6; s[7] += d7;
    }

    extractByte(): number {
        this.cycle();
        const raw = (Math.abs(this.state[0] * 100) ^ 
                     Math.abs(this.state[4] * 100) ^ 
                     Math.abs(this.state[5] * 100) ^
                     Math.abs(this.state[6] * 50) ^
                     Math.abs(this.state[7] * 50));
        return SBOX_CORE[Math.floor(raw) & 0xFF];
    }
}

class BitWeaver {
    static rotateLeft(byte: number, amount: number): number {
        return ((byte << amount) | (byte >>> (8 - amount))) & 0xFF;
    }
    
    static rotateRight(byte: number, amount: number): number {
        return ((byte >>> amount) | (byte << (8 - amount))) & 0xFF;
    }

    static computeHMAC(data: Uint8Array, key: Uint8Array): Uint8Array {
        const result = new Uint8Array(16);
        let hash = 5381;
        
        for(let i = 0; i < data.length; i++) {
            hash = ((hash << 5) + hash) ^ data[i];
            hash = ((hash << 5) + hash) ^ key[i % key.length];
        }
        
        for(let i = 0; i < 16; i++) {
            result[i] = (hash >>> (i * 2)) & 0xFF;
            hash = ((hash << 5) + hash) ^ result[i];
        }
        
        return result;
    }
}

const packHeader = (params: ChaosParams): Uint8Array => {
    const buffer = new ArrayBuffer(58);
    const view = new DataView(buffer);
    
    view.setUint8(0, MAGIC_PREFIX);
    view.setUint8(1, FORMAT_VERSION);
    
    view.setFloat64(2, params.sigma);
    view.setFloat64(10, params.rho);
    view.setFloat64(18, params.beta);
    view.setFloat64(26, params.startX);
    view.setFloat64(34, params.startY);
    view.setFloat64(42, params.startZ);
    view.setFloat64(50, params.iterations);

    const bytes = new Uint8Array(buffer);
    
    for(let i=0; i<bytes.length; i++) {
        bytes[i] ^= ARTIFACT_KEY[i % ARTIFACT_KEY.length];
        bytes[i] ^= SECONDARY_KEY[i % SECONDARY_KEY.length];
    }
    
    return bytes;
};

const unpackHeader = (bytes: Uint8Array): ChaosParams => {
    if (bytes.length !== 58) throw new Error("Invalid header: corrupted size");
    
    const plain = new Uint8Array(58);
    
    for(let i=0; i<58; i++) {
        plain[i] = bytes[i];
        plain[i] ^= SECONDARY_KEY[i % SECONDARY_KEY.length];
        plain[i] ^= ARTIFACT_KEY[i % ARTIFACT_KEY.length];
    }
    
    if (plain[0] !== MAGIC_PREFIX) throw new Error("Invalid header: magic bytes mismatch");
    if (plain[1] !== FORMAT_VERSION) throw new Error("Invalid header: version mismatch");
    
    const view = new DataView(plain.buffer);
    
    const params = {
        sigma: view.getFloat64(2),
        rho: view.getFloat64(10),
        beta: view.getFloat64(18),
        startX: view.getFloat64(26),
        startY: view.getFloat64(34),
        startZ: view.getFloat64(42),
        iterations: view.getFloat64(50)
    };
    
    if (!isFinite(params.sigma) || !isFinite(params.rho) || !isFinite(params.beta)) {
        throw new Error("Invalid header: parameter validation failed");
    }
    
    return params;
};

const validateInput = (message: string): void => {
    if (!message || message.length === 0) {
        throw new Error("Message cannot be empty");
    }
    if (message.length > MAX_MESSAGE_SIZE) {
        throw new Error(`Message exceeds maximum size of ${MAX_MESSAGE_SIZE} bytes`);
    }
    for(let i = 0; i < message.length; i++) {
        const code = message.charCodeAt(i);
        if (!isFinite(code)) {
            throw new Error("Message contains invalid characters");
        }
    }
};

const validateBlob = (blob: string): Uint8Array => {
    if (!blob || blob.length === 0) {
        throw new Error("Encrypted blob cannot be empty");
    }
    if (blob.length > MAX_MESSAGE_SIZE * 2) {
        throw new Error("Encrypted blob exceeds maximum size");
    }
    
    try {
        const raw = atob(blob);
        const data = new Uint8Array(raw.length);
        for(let i=0; i<raw.length; i++) {
            data[i] = raw.charCodeAt(i);
        }
        return data;
    } catch (e) {
        throw new Error("Invalid encrypted blob: not valid Base64");
    }
};

const secureWipe = (buffer: Uint8Array | Float64Array): void => {
    buffer.fill(0);
};

export const encryptMessage = (message: string, params: ChaosParams, customKey?: CustomKey): string => {
    validateInput(message);
    
    try {
        const salt = new Uint8Array(32);
        crypto.getRandomValues(salt);

        const engine = new HyperVectorEngine(params, salt, customKey);
        const encoder = new TextEncoder();
        const input = encoder.encode(message);

        const headerSize = 58;
        const saltSize = 32;
        const hmacSize = 16;
        const customKeySize = customKey ? 1 + 32 : 0;
        const output = new Uint8Array(headerSize + saltSize + hmacSize + customKeySize + input.length);
        
        const header = packHeader(params);
        output.set(header, 0);
        output.set(salt, headerSize);

        let payloadStart = headerSize + saltSize + hmacSize + customKeySize;

        if (customKey) {
            output[headerSize + saltSize + hmacSize] = CUSTOM_KEY_MARKER;
            for(let i = 0; i < 32; i++) {
                output[headerSize + saltSize + hmacSize + 1 + i] = customKey.metadata[i % customKey.metadata.length];
            }
        }

        for(let i=0; i<input.length; i++) {
            const p = input[i];
            const k1 = engine.extractByte();
            const k2 = engine.extractByte();
            const k3 = engine.extractByte();
            const rot = (k1 ^ k2 ^ k3) % 7;
            
            let c = p ^ k1 ^ k2 ^ k3;
            c = BitWeaver.rotateLeft(c, rot);
            
            output[payloadStart + i] = c;
        }

        const hmacData = new Uint8Array(headerSize + saltSize + input.length);
        hmacData.set(header, 0);
        hmacData.set(salt, headerSize);
        for(let i=0; i<input.length; i++) {
            hmacData[headerSize + saltSize + i] = output[payloadStart + i];
        }

        const hmac = BitWeaver.computeHMAC(hmacData, HMAC_KEY);
        output.set(hmac, headerSize + saltSize);

        const result = btoa(String.fromCharCode(...output));
        
        secureWipe(new Uint8Array(salt));
        secureWipe(input);
        
        return result;
    } catch (e) {
        throw new Error(`Encryption failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
};

export const decryptMessage = (blob: string, customKey?: CustomKey): { message: string, params: ChaosParams } => {
    try {
        const data = validateBlob(blob);

        if (data.length < 106) throw new Error("Corrupted blob: insufficient length");

        const headerBytes = data.slice(0, 58);
        const params = unpackHeader(headerBytes);

        const salt = data.slice(58, 90);
        const storedHmac = data.slice(90, 106);

        let payloadStart = 106;
        let useCustomKey = false;

        if (data.length > 106 && data[106] === CUSTOM_KEY_MARKER) {
            if (!customKey) {
                throw new Error("This message was encrypted with a custom key. Please provide the custom key to decrypt.");
            }
            
            // Verify custom key metadata matches
            const storedMetadata = data.slice(107, 139);
            let metadataMatch = true;
            for(let i = 0; i < 32; i++) {
                if (storedMetadata[i] !== customKey.metadata[i % customKey.metadata.length]) {
                    metadataMatch = false;
                    break;
                }
            }
            if (!metadataMatch) {
                throw new Error("Invalid custom key: metadata mismatch");
            }
            
            useCustomKey = true;
            payloadStart = 139;
        } else if (customKey) {
            // User provided a custom key but message wasn't encrypted with one
            throw new Error("This message was encrypted with the default key, not a custom key.");
        }

        const payload = data.slice(payloadStart);

        const hmacData = new Uint8Array(58 + 32 + payload.length);
        hmacData.set(headerBytes, 0);
        hmacData.set(salt, 58);
        hmacData.set(payload, 90);

        const computedHmac = BitWeaver.computeHMAC(hmacData, HMAC_KEY);
        
        let hmacValid = true;
        for(let i = 0; i < 16; i++) {
            if (storedHmac[i] !== computedHmac[i]) {
                hmacValid = false;
            }
        }
        if (!hmacValid) {
            throw new Error("Integrity check failed: blob has been tampered with");
        }

        const engine = new HyperVectorEngine(params, salt, useCustomKey ? customKey : undefined);
        const decrypted = new Uint8Array(payload.length);

        for(let i=0; i<payload.length; i++) {
            const c = payload[i];
            const k1 = engine.extractByte();
            const k2 = engine.extractByte();
            const k3 = engine.extractByte();
            const rot = (k1 ^ k2 ^ k3) % 7;

            let p = BitWeaver.rotateRight(c, rot);
            p = p ^ k1 ^ k2 ^ k3;
            
            decrypted[i] = p;
        }

        const decoder = new TextDecoder();
        const message = decoder.decode(decrypted);
        
        if (message.length === 0) {
            throw new Error("Decryption produced empty message");
        }

        secureWipe(decrypted);
        
        return {
            message: message,
            params: params
        };

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'unknown error';
        if (errorMsg.includes("Integrity check failed")) {
            throw new Error("SECURITY ALERT: Blob authentication failed - possible tampering detected");
        }
        throw new Error(`Decryption failed: ${errorMsg}`);
    }
};

export const generateRandomParams = (): ChaosParams => {
    return {
        sigma: 9.5 + (Math.random() * 1.0),
        rho: 27.5 + (Math.random() * 1.0),
        beta: 2.5 + (Math.random() * 0.2),
        startX: (Math.random() * 200) - 100,
        startY: (Math.random() * 200) - 100,
        startZ: (Math.random() * 150),
        iterations: 0
    };
};

export const generateCustomKey = (): CustomKey => {
    const key = new Uint8Array(256);
    const metadata = new Uint8Array(32);
    crypto.getRandomValues(key);
    crypto.getRandomValues(metadata);
    
    return {
        key,
        metadata,
        timestamp: Date.now()
    };
};

export const serializeCustomKey = (customKey: CustomKey): string => {
    const combined = new Uint8Array(296);
    combined.set(customKey.key, 0);
    combined.set(customKey.metadata, 256);
    
    const view = new DataView(combined.buffer);
    view.setUint32(288, Math.floor(customKey.timestamp / 1000), false);
    
    return btoa(String.fromCharCode(...combined));
};

export const deserializeCustomKey = (serialized: string): CustomKey => {
    try {
        const raw = atob(serialized);
        const data = new Uint8Array(raw.length);
        for(let i = 0; i < raw.length; i++) {
            data[i] = raw.charCodeAt(i);
        }
        
        if (data.length < 296) throw new Error("Invalid custom key format");
        
        const view = new DataView(data.buffer);
        const timestamp = view.getUint32(288, false) * 1000;
        
        return {
            key: data.slice(0, 256),
            metadata: data.slice(256, 288),
            timestamp
        };
    } catch (e) {
        throw new Error("Failed to deserialize custom key");
    }
};
