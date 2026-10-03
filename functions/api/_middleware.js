import { CryptoUtils } from './crypto.js';

export async function onRequest(context) {
    const request = context.request;
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
        return context.next();
    }

    let modifiedRequest = request;

    try {
        if (request.method === "GET" || request.method === "HEAD") {
            const encParam = url.searchParams.get("enc");
            if (encParam) {
                // If it has ?enc=... we decrypt it
                // Note: we replace spaces with + because URL search params might have decoded + to space
                const base64Str = encParam.replace(/ /g, '+');
                const decryptedQuery = await CryptoUtils.decryptText(base64Str);
                const newUrl = new URL(url.origin + url.pathname + "?" + decryptedQuery);
                modifiedRequest = new Request(newUrl.toString(), request);
            }
        } else {
            const clonedReq = request.clone();
            const textBody = await clonedReq.text();
            if (textBody) {
                try {
                    const jsonBody = JSON.parse(textBody);
                    if (jsonBody && jsonBody.enc) {
                        const decryptedPayload = await CryptoUtils.decryptText(jsonBody.enc);
                        modifiedRequest = new Request(request.url, {
                            method: request.method,
                            headers: request.headers,
                            body: decryptedPayload
                        });
                    }
                } catch(e) { }
            }
        }
    } catch(err) {}

    const response = await context.next(modifiedRequest);

    const contentType = response.headers.get("content-type") || "";
    // Encrypt JSON responses
    if (response.ok && contentType.includes("application/json")) {
        try {
            const clonedRes = response.clone();
            const resText = await clonedRes.text();
            const encryptedData = await CryptoUtils.encryptText(resText);
            
            const newHeaders = new Headers(response.headers);
            newHeaders.set("content-type", "application/json");
            
            return new Response(JSON.stringify({ enc: encryptedData }), {
                status: response.status,
                headers: newHeaders
            });
        } catch(err) {
            return response;
        }
    }

    return response;
}
