/**
 * Master Ultimate API - No Firebase
 * Handles BOTH NextToppers Content (AES Decryption) & VideoCrypt DRM
 * File Path: functions/vc/[id].js
 */

export async function onRequestOptions(context) {
    const { request } = context;
    const allowedOrigins = [
        "https://studybeepro.site",
        "https://learnbyakp.online",
        "https://studybeeclone.pages.dev"
    ];

    const origin = request.headers.get("Origin");
    const corsOrigin = allowedOrigins.includes(origin) ? origin : "*";

    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    });
}

export async function onRequestGet(context) {
    const { request, params } = context;
    const url = new URL(request.url);

    // ==========================================
    // 1. CORS SECURITY
    // ==========================================
    const allowedOrigins = [
        "https://studybeepro.site",
        "https://learnbyakp.online",
        "https://studybeeclone.pages.dev"
    ];
    const origin = request.headers.get("Origin");
    const corsOrigin = allowedOrigins.includes(origin) ? origin : "*";

    const corsHeaders = {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // The dynamic path parameter (e.g., 'media' OR '4823621_0_2168629681868995')
    const id = params.id; 

    // ==========================================
    // ROUTE 1: NEXT-TOPPERS CONTENT FETCH (PDFs/Info)
    // Example: /vc/media?course_id=101&content_id=18604
    // ==========================================
    if (id === 'media') {
        const courseId = url.searchParams.get('course_id');
        const contentId = url.searchParams.get('content_id');

        if (!courseId || !contentId) {
            return new Response(JSON.stringify({ status: false, reason: "course_id and content_id are required!" }), { 
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
        }

        // 🔥 SINGLE MASTER TOKEN (Replace if this expires) 🔥
        const MASTER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozNTM3OTYyLCJhcHBfaWQiOiIxNzcwOTgxMzQ3IiwiZGV2aWNlX2lkIjoiNmNmYWQyNmYtNDYxOS00YzkwLTlkYzktMzdlNjE2YmMzZTdiIiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3ODkwNzIwNzcsImV4cCI6MTc5MTY2NDA3N30.UuhVkDI72mmuYS7zvGa85YY5Nc2lIW8ZIDOge_1DUso";

        function buildHeaders(token) {
            return {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-GB,en;q=0.5",
                "app_id": "1770981347",
                "authorization": `Bearer ${token}`,
                "content-type": "application/json",
                "origin": "https://nexttoppers.com",
                "platform": "3",
                "referer": "https://nexttoppers.com/",
                "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36",
                "user_id": "3537962",
                "version": "1"
            };
        }

        async function decryptData(encryptedData) {
            const algorithm = 'AES-CBC';
            const secretKey = new TextEncoder().encode('Ch@tS3cr3tK3y!16');
            const iv = new TextEncoder().encode('Ch@tIV#16Bytes!!');
            try {
                const binaryData = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
                const cryptoKey = await crypto.subtle.importKey('raw', secretKey, { name: algorithm }, false, ['decrypt']);
                const decryptedBuffer = await crypto.subtle.decrypt({ name: algorithm, iv: iv }, cryptoKey, binaryData);
                return JSON.parse(new TextDecoder().decode(decryptedBuffer));
            } catch (error) {
                return null;
            }
        }

        try {
            const apiUrl = `https://course.nexttoppers.com/course/content-details?content_id=${contentId}&course_id=${courseId}`;
            const response = await fetch(apiUrl, { method: 'GET', headers: buildHeaders(MASTER_TOKEN) });
            const data = await response.json();

            if (response.ok && data && data.data) {
                const decrypted = await decryptData(data.data);
                if (decrypted) {
                    return new Response(JSON.stringify({
                        success: true,
                        contentId: contentId,
                        courseId: courseId,
                        decryptedData: decrypted,
                        originalResponse: data
                    }, null, 2), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
                }
            }
            
            return new Response(JSON.stringify({ status: false, reason: "Decryption failed or token expired.", data: data }), { 
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });

        } catch (error) {
            return new Response(JSON.stringify({ status: false, reason: "Fetch failed", error: error.message }), { 
                status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
        }
    }

    // ==========================================
    // ROUTE 2: VIDEOCRYPT DRM API (For Videos)
    // Example: /vc/4779502_0_5757684487513427
    // ==========================================
    if (id && id.includes('_')) {
        const drmApiUrl = `https://api.videocrypt.com/getVideoDetailsDrm`;
        const drmHeaders = {
            'accept': 'application/json, text/plain, */*',
            'accesskey': 'WEU1QzAxMjZVRzlLUVJKTjNCTDc=',
            'account-id': '10004141',
            'content-type': 'application/json',
            'device-id': '71d3548555586126ed7071102e663619',
            'device-name': '1',
            'device-type': '1',
            'origin': 'https://nexttoppers.com',
            'referer': 'https://nexttoppers.com/',
            'secretkey': 'QVZNditHMENJZDFGYlIvUUt1VG9Zd081WEhqZm44dERQMzdKTnFaNA==',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'user-id': '3875028',
            'version': '1'
        };

        try {
            const drmResponse = await fetch(drmApiUrl, {
                method: 'POST',
                headers: drmHeaders,
                body: JSON.stringify({ name: id, flag: 1 }) 
            });
            const drmDetails = await drmResponse.json();
            
            return new Response(JSON.stringify({ 
                success: true, 
                source: "videocrypt", 
                data: drmDetails 
            }, null, 2), { 
                status: 200, 
                headers: { 
                    "Content-Type": "application/json", 
                    "Cache-Control": "public, max-age=300", 
                    ...corsHeaders 
                } 
            });
        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: "DRM fetch failed" }), { 
                status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
        }
    }

    // Fallback error
    return new Response(JSON.stringify({ success: false, error: "Invalid Route Requested." }), { 
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
}
