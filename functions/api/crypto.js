const SECRET_PASSWORD = "NTNEW_SUPER_SECRET_E2EE_PASSWORD_2026";

async function getCryptoKey() {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SECRET_PASSWORD));
    return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function encryptText(text) {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoded
    );
    
    // Concat iv and ciphertext
    const payload = new Uint8Array(iv.length + ciphertext.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ciphertext), iv.length);
    
    return bufferToBase64(payload.buffer);
}

async function decryptText(encryptedBase64) {
    const key = await getCryptoKey();
    const payload = new Uint8Array(base64ToBuffer(encryptedBase64));
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

export const CryptoUtils = { encryptText, decryptText };
