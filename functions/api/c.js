export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);

    // ==========================================
    // 1. CORS & ORIGIN SECURITY
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

    const contentId = url.searchParams.get('content_id') || '17513';
    const courseId = url.searchParams.get('course_id') || '1';
    const action = url.searchParams.get('action'); 
    const classType = url.searchParams.get('type') || '1'; 
    const accessKey = url.searchParams.get('key');
    const deviceId = url.searchParams.get('device_id');

    // ==========================================
    // 📊 NEW: ANALYTICS TRACKING SYSTEM (analytis-f0a67)
    // ==========================================
    async function trackKeyUsage(key) {
        if (!key) return;
        const safeKey = encodeURIComponent(key);
        const getUrl = `https://firestore.googleapis.com/v1/projects/analytis-f0a67/databases/(default)/documents/key_analytics/${safeKey}?key=AIzaSyApgSQopA9eFDbdWOtJ6eCvkvLg57Y6yVo`;
        
        try {
            let count = 1;
            const res = await fetch(getUrl);
            if (res.ok) {
                const data = await res.json();
                count = parseInt(data.fields?.request_count?.integerValue || 0) + 1;
            }
            
            const patchUrl = `https://firestore.googleapis.com/v1/projects/analytis-f0a67/databases/(default)/documents/key_analytics/${safeKey}?key=AIzaSyApgSQopA9eFDbdWOtJ6eCvkvLg57Y6yVo`;
            const payload = {
                fields: {
                    key_name: { stringValue: key },
                    request_count: { integerValue: String(count) },
                    last_used: { timestampValue: new Date().toISOString() }
                }
            };
            
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch(e) { }
    }

    if (accessKey) {
        context.waitUntil(trackKeyUsage(accessKey));
    }

    // ==========================================
    // 🛡️ TIER 0: FIREBASE KEY SECURITY (smexgod)
    // ==========================================
    if (!accessKey) {
        return new Response(JSON.stringify({ status: false, reason: "Premium Access Key is missing!" }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    try {
        const firestoreAuthUrl = `https://firestore.googleapis.com/v1/projects/smexgod/databases/(default)/documents/valid_keys/${accessKey}?key=AIzaSyAzxBCRdwK4NIyGwkzBrV9ev_53MJIfsOM`;
        const fsResponse = await fetch(firestoreAuthUrl);
        
        if (fsResponse.status === 404) return new Response(JSON.stringify({ status: false, reason: "Invalid Access Key!" }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

        const fsData = await fsResponse.json();
        const fields = fsData.fields;
        if (!fields) return new Response(JSON.stringify({ status: false, reason: "Corrupted Key Data." }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

        const keyStatus = fields.status?.stringValue || "";
        const expiresAt = parseInt(fields.expiresAt?.integerValue || fields.expiresAt?.doubleValue || '0');
        const maxDevices = parseInt(fields.maxDevices?.integerValue || '1');
        
        let registeredDevices = [];
        if (fields.registeredDevices?.arrayValue?.values) {
            registeredDevices = fields.registeredDevices.arrayValue.values.map(v => v.stringValue);
        }

        if (keyStatus !== "active") return new Response(JSON.stringify({ status: false, reason: "This key is currently inactive." }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        if (Date.now() > expiresAt) return new Response(JSON.stringify({ status: false, reason: "Your access key has expired." }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        
        if (deviceId && !registeredDevices.includes(deviceId) && registeredDevices.length >= maxDevices) {
            return new Response(JSON.stringify({ status: false, reason: "Device limit reached. Use the registered device." }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
    } catch (err) {
        return new Response(JSON.stringify({ status: false, reason: "Security verification failed on server." }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ==========================================
    // 🔥 TIER 1: FETCH TOKENS FROM FIREBASE (nttokens)
    // ==========================================
    let tokensToTry = [];
    const defaultToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0NzE5ODgsImFwcF9pZCI6IjE3NzA5ODEzNDciLCJkZXZpY2VfaWQiOiI2Y2ZhZDI2Zi00NjE5LTRjOTAtOWRjOS0zN2U2MTZiYzNlN2IiLCJwbGF0Zm9ybSI6IjMiLCJ1c2VyX3R5cGUiOjEsImlhdCI6MTc4NDk3MTEwNywiZXhwIjoxNzg3NTYzMTA3fQ.3WxRLkxbJx_F3no34NmAUyBLvJu7A5CUB6m91h39-2M";
    const nttokensApiKey = "AIzaSyCKIiwcFthl-P8Cw6kF5NxsDOW7GaRwhNQ";
    let documentRefUrl = ""; // Save reference to update later if token expires

    try {
        documentRefUrl = `https://firestore.googleapis.com/v1/projects/nttokens/databases/(default)/documents/CourseTokens/${courseId}?key=${nttokensApiKey}`;
        const tokenRes = await fetch(documentRefUrl);
        
        if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.fields && tokenData.fields.tokens && tokenData.fields.tokens.arrayValue && tokenData.fields.tokens.arrayValue.values) {
                tokensToTry = tokenData.fields.tokens.arrayValue.values.map(v => v.stringValue);
            }
        }
    } catch (e) {
        // Silently fail and use default
    }

    if (tokensToTry.length === 0) {
        tokensToTry.push(defaultToken);
    }

    // 🔥 Helper Function to DELETE dead tokens from Firebase
    async function removeExpiredTokenFromDB(deadToken) {
        if (!documentRefUrl) return;
        try {
            // First re-fetch the current state
            const docRes = await fetch(documentRefUrl);
            if (!docRes.ok) return;
            const docData = await docRes.json();
            
            if (docData.fields && docData.fields.tokens && docData.fields.tokens.arrayValue && docData.fields.tokens.arrayValue.values) {
                let currentTokens = docData.fields.tokens.arrayValue.values.map(v => v.stringValue);
                
                // Filter out the dead token
                const updatedTokens = currentTokens.filter(t => t !== deadToken);
                
                // If it actually existed and we removed it, patch the document
                if (currentTokens.length !== updatedTokens.length) {
                    
                    let tokensField = { arrayValue: {} };
                    if (updatedTokens.length > 0) {
                        tokensField.arrayValue.values = updatedTokens.map(t => ({ stringValue: t }));
                    }

                    const updatePayload = {
                        fields: {
                            ...docData.fields, // Preserve other fields like course_id and auth_response_data
                            tokens: tokensField,
                            updated_at: { stringValue: new Date().toISOString() } // Keep timestamp fresh
                        }
                    };

                    await fetch(documentRefUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatePayload)
                    });
                }
            }
        } catch (e) {
            // Background fail, don't interrupt response
        }
    }

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

    // ==========================================
    // ⚔️ TIER 2: HANDLE "classes" ACTION (AUTO-RETRY LOOP)
    // ==========================================
    if (action === 'classes') {
        for (const token of tokensToTry) {
            try {
                const classesResponse = await fetch('https://course.nexttoppers.com/course/classes', {
                    method: 'POST', 
                    headers: buildHeaders(token),
                    body: JSON.stringify({ type: classType, page: "1", limit: "1000", course_id: courseId })
                });

                const data = await classesResponse.json();

                // 🔥 EXACT JSON EXPIRATION CHECK 🔥
                if (
                    classesResponse.status === 401 || 
                    classesResponse.status === 403 || 
                    data.responseCode == "1110004" || 
                    data.message === "Invalid or expired token."
                ) {
                    if (token !== defaultToken) {
                        context.waitUntil(removeExpiredTokenFromDB(token)); 
                    }
                    continue; // Skip to next token
                }

                if (classesResponse.ok && data.success !== false) {
                    return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json', ...corsHeaders }});
                }
            } catch (error) { continue; }
        }
        return new Response(JSON.stringify({ error: 'All tokens expired for classes fetch.' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    function extractFinalUrl(obj) {
        if (!obj) return "";
        const commonKeys = ['file_url', 'url', 'link', 'pdf_link', 'videoUrl', 'aws_url', 'pdf_url'];
        for (const key of commonKeys) {
            if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 5) return obj[key];
        }
        if (typeof obj === 'object') {
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    const found = extractFinalUrl(obj[key]);
                    if (found) return found;
                }
            }
        }
        return "";
    }

    // ==========================================
    // ⚔️ TIER 2: HANDLE "content-details" ACTION (AUTO-RETRY LOOP)
    // ==========================================
    let finalDecryptedData = null;
    let finalOriginalResponse = null;
    let finalDrmDetails = null;

    for (const token of tokensToTry) {
        try {
            const apiUrl = `https://api.videocrypt.com?content_id=${contentId}`;
            const response = await fetch(apiUrl, { method: 'GET', headers: buildHeaders(token) });
            const data = await response.json();

            // 🔥 EXACT JSON EXPIRATION CHECK 🔥
            if (
                response.status === 401 || 
                response.status === 403 || 
                data.responseCode == "1110004" || 
                data.message === "Invalid or expired token."
            ) {
                if (token !== defaultToken) {
                    context.waitUntil(removeExpiredTokenFromDB(token)); 
                }
                continue; // Skip to next token
            }

            if (response.ok && data && data.data) {
                const decrypted = await decryptData(data.data);
                if (decrypted && Object.keys(decrypted).length > 0) {
                    finalOriginalResponse = data;
                    finalDecryptedData = decrypted;
                    break; // Target acquired! Break out of the loop
                }
            }
        } catch (error) { continue; }
    }

    // ==========================================
    // 💾 TIER 2.5: AUTO-SAVE TO BACKUP DB (stechshope)
    // ==========================================
    if (finalDecryptedData && Object.keys(finalDecryptedData).length > 0) {
        const fileUrl = extractFinalUrl(finalDecryptedData);
        if (fileUrl) {
            const title = finalDecryptedData.title || "Premium Content";
            const isLive = finalDecryptedData.is_live === 1 || finalDecryptedData.is_live === '1';
            const fileTypeStr = (finalDecryptedData.file_type === 1 || fileUrl.includes('.pdf')) ? 'pdf' : ((finalDecryptedData.video_type === 1 || fileUrl.includes('youtu')) ? 'youtube' : 'video');
            
            const payload = {
                fields: {
                    course_id: { stringValue: String(courseId) },
                    content_id: { stringValue: String(contentId) },
                    title: { stringValue: title },
                    file_url: { stringValue: fileUrl },
                    thumbnail: { stringValue: finalDecryptedData.thumbnail || "" },
                    duration: { stringValue: String(finalDecryptedData.duration || "0") },
                    is_live: { booleanValue: isLive },
                    file_type: { stringValue: fileTypeStr },
                    saved_at: { stringValue: new Date().toISOString() }
                }
            };

            context.waitUntil((async () => {
                try {
                    const saveUrl = `https://firestore.googleapis.com/v1/projects/stechshope/databases/(default)/documents/Courses/${courseId}/contents/${contentId}?key=AIzaSyDzofhvQGWmgJAZbHGUVn96dITkrPPlu8Q`;
                    await fetch(saveUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch(e) {}
            })());
        }
    }

    // ==========================================
    // 🚨 TIER 3: ULTIMATE FALLBACK DB (stechshope)
    // ==========================================
    let isBackupUsed = false;

    if (!finalDecryptedData) {
        isBackupUsed = true;
        try {
            const firebaseRestUrl = `https://firestore.googleapis.com/v1/projects/stechshope/databases/(default)/documents/Courses/${courseId}/contents/${contentId}?key=AIzaSyDzofhvQGWmgJAZbHGUVn96dITkrPPlu8Q`;
            const fbRes = await fetch(firebaseRestUrl);
            if (fbRes.ok) {
                const fbData = await fbRes.json();
                const fields = fbData.fields;
                if (fields && fields.file_url) {
                    finalDecryptedData = {
                        title: fields.title?.stringValue || "Premium Video (Backup)",
                        file_url: fields.file_url?.stringValue || "",
                        thumbnail: fields.thumbnail?.stringValue || "",
                        is_drm: 0,
                        file_type: fields.file_type?.stringValue === 'youtube' ? 1 : 0, 
                        video_type: fields.file_type?.stringValue === 'youtube' ? 1 : 0,
                        is_live: fields.is_live?.booleanValue ? 1 : 0,
                        duration: fields.duration?.stringValue || "0"
                    };
                }
            }
        } catch (e) {
            // Backup DB also failed
        }
    }

    if (!finalDecryptedData) {
        return new Response(JSON.stringify({ 
            status: false, 
            message: 'Media not found. All tokens expired AND backup DB failed.',
            errorType: 'TotalFailure'
        }, null, 2), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!isBackupUsed && (finalDecryptedData.is_drm == 1 || finalDecryptedData.is_drm === '1') && finalDecryptedData.vdc_id) {
        const drmApiUrl = `https://api.videocrypt.com/getVideoDetailsDrm`;
        const drmHeaders = {
            'accept': 'application/json, text/plain, */*',
            'accesskey': 'WEU1QzAxMjZVRzlLUVJKTjNCTDc=',
            'account-id': '10004141',
            'content-type': 'application/json',
            'device-id': '71d3548555586126ed7071102e663619',
            'device-name': '1', 'device-type': '1',
            'origin': 'https://nexttoppers.com', 'referer': 'https://nexttoppers.com/',
            'secretkey': 'QVZNditHMENJZDFGYlIvUUt1VG9Zd081WEhqZm44dERQMzdKTnFaNA==',
            'user-agent': 'Mozilla/5.0',
            'user-id': '3875028', 'version': '1'
        };

        try {
            const drmResponse = await fetch(drmApiUrl, { method: 'POST', headers: drmHeaders, body: JSON.stringify({ name: finalDecryptedData.vdc_id, flag: 1 }) });
            finalDrmDetails = await drmResponse.json();
        } catch (drmErr) {
            finalDrmDetails = { error: 'Failed to fetch DRM info' };
        }
    }

    // 🔥 SEND FINAL SUCCESS RESPONSE
    return new Response(JSON.stringify({
        contentId: contentId,
        courseId: courseId,
        decryptedData: finalDecryptedData,
        drm_details: finalDrmDetails, 
        is_backup_used: isBackupUsed,
        originalResponse: finalOriginalResponse
    }, null, 2), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

export async function onRequestOptions(context) {
    const { request } = context;
    const allowedOrigins = ["https://studybeepro.site", "https://learnbyakp.online", "https://studybeeclone.pages.dev"];
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
