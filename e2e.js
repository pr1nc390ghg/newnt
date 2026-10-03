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

const ORIGINAL_FETCH = window.fetch;

window.fetch = async function() {
    let url = arguments[0];
    let options = arguments[1] || {};
    
    let urlStr = (typeof url === 'string') ? url : (url instanceof Request ? url.url : url.toString());
    
    // Only intercept calls that go to our API
    if (urlStr.includes('/api/')) {
        let reqMethod = (options.method || (url instanceof Request ? url.method : "GET")).toUpperCase();
        
        try {
            if (reqMethod === "GET" || reqMethod === "HEAD") {
                const u = new URL(urlStr, window.location.origin);
                const queryStr = u.search.substring(1); // without ?
                if (queryStr && !queryStr.startsWith("enc=")) {
                    const encryptedQuery = await encryptText(queryStr);
                    u.search = "?enc=" + encodeURIComponent(encryptedQuery);
                    if (typeof url === 'string') {
                        arguments[0] = u.toString();
                    } else if (url instanceof Request) {
                        arguments[0] = new Request(u.toString(), url);
                    } else {
                        arguments[0] = u;
                    }
                }
            } else {
                // POST/PUT
                let bodyText = "";
                if (options.body) {
                    if (typeof options.body === 'string') bodyText = options.body;
                    else bodyText = JSON.stringify(options.body);
                } else if (url instanceof Request) {
                    bodyText = await url.clone().text();
                }
                
                if (bodyText) {
                    const encryptedBody = await encryptText(bodyText);
                    const newBody = JSON.stringify({ enc: encryptedBody });
                    
                    if (url instanceof Request) {
                        arguments[0] = new Request(url.url, {
                            ...url,
                            body: newBody
                        });
                    } else {
                        options.body = newBody;
                        arguments[1] = options;
                    }
                }
            }
        } catch(err) {
            console.error("E2EE Frontend Request Error:", err);
        }
    }

    const response = await ORIGINAL_FETCH.apply(this, arguments);

    if (urlStr.includes('/api/') && response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const clonedResponse = response.clone();
            try {
                const json = await clonedResponse.json();
                if (json && json.enc) {
                    const decryptedText = await decryptText(json.enc);
                    
                    // Create a new response with the decrypted text
                    return new Response(decryptedText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (err) {
                console.error("E2EE Frontend Response Error:", err);
            }
        }
    }
    
    return response;
};
