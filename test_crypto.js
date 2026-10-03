const crypto = require("crypto");

async function getCryptoKey() {
    // using web crypto in node
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("NTNEW_SUPER_SECRET_E2EE_PASSWORD_2026"));
    return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}

function base64ToBuffer(base64) {
    return Buffer.from(base64, 'base64');
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

(async () => {
    const orig = "course_id=1&content_id=123";
    const enc = await encryptText(orig);
    console.log("Encrypted:", enc);
    const dec = await decryptText(enc);
    console.log("Decrypted:", dec);
})();
