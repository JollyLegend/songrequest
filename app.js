const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const redirectUri = 'https://jollylegend.github.io/songrequest/';

const addHistory = {};

// --- AUTH HELPERS ---
const generateRandomString = (l) => {
    const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return [...crypto.getRandomValues(new Uint8Array(l))].map(x => p[x % p.length]).join('');
}
const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    return window.crypto.subtle.digest('SHA-256', encoder.encode(plain));
}
const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function redirectToAuthCodeFlow() {
    const verifier = generateRandomString(128);
    const challenge = base64encode(await sha256(verifier));
    localStorage.setItem("code_verifier", verifier);
    const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, scope: "user-modify-playback-state user-read-playback-state", code_challenge_method: "S256", code_challenge: challenge });
    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function getAccessToken(code) {
    const verifier = localStorage.getItem("code_verifier");
    const params = new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
    const result = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const data = await result.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;
    const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
    const result = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const data = await result.json();
    if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        return data.access_token;
    }
    return null;
}

async function fetchSpotify(endpoint, method = 'GET', body = null) {
    let token = localStorage.getItem('access_token');
    if (!token) return null;

    const f = async (t) => fetch(`https://api.spotify.com/v1${endpoint}`, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
    
    let res = await f(token);
    if (res.status === 401) { token = await refreshAccessToken(); if (token) res = await f(token); }
    
    // Return the full response for 'POST' so we can check status codes
    if (method === 'POST') return res;
    return res.status === 204 ? null : await res.json();
}

// --- SEARCH & RESULTS ---
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        if (e.target.value.length < 3) return;
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`);
        if (data && data.tracks) displayResults(data.tracks.items);
    });
}

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => {
        const safeName = track.name.replace(/'/g, "\\'");
        return `
            <div class="song-card" onclick="addToQueue('${track.uri}', '${safeName}')">
                <img src="${track.album.images[2].url}" width="40" alt="art" style="border-radius:4px;">
                <div class="song-info">
                    <span class="song-title">${track.name}</span>
                    <span class="song-artist">${track.artists[0].name}</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- UPDATED ADD TO QUEUE LOGIC ---
async function addToQueue(uri, songName) {
    const now = Date.now();
    const resultsDiv = document.getElementById('results');

    // Duplicate Check
    if (addHistory[uri] && (now - addHistory[uri] < 30000)) {
        resultsDiv.innerHTML = `<div class="status-box loading">⚠️ "${songName}" is already coming up!</div>`;
        setTimeout(() => { resultsDiv.innerHTML = ""; }, 3000);
        return; 
    }

    // Step 1: Immediate Loading State
    resultsDiv.innerHTML = `
        <div class="status-box loading">
            <h3 style="margin: 0; color: #b3b3b3;">Connecting to car... 📡</h3>
            <p style="margin: 5px 0 0 0; font-size: 0.8em;">Requesting ${songName}</p>
        </div>
    `;
    if (searchInput) searchInput.value = "";

    try {
        const response = await fetchSpotify(`/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
        
        // Step 2: Optimistic Success Check
        // Spotify returns 204 or 200 for a successful queue add
        if (response && (response.status === 204 || response.status === 200)) {
            addHistory[uri] = now;
            resultsDiv.innerHTML = `
                <div class="status-box success">
                    <h3 style="margin: 0; color: var(--spotify-green);">Success! 🎧</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;"><strong>${songName}</strong> added to queue.</p>
                </div>
            `;
        } else {
            throw new Error("Invalid response");
        }
    } catch (err) {
        // Fallback: If it's a 204 it actually worked, if it's a real error, show it
        resultsDiv.innerHTML = `<div class="status-box loading">❌ Not playing on Spotify. Make sure the driver hits play!</div>`;
    }

    // Step 3: Wait 4 seconds before clearing and updating the list
    setTimeout(() => {
        resultsDiv.innerHTML = "";
        updateQueue(); 
    }, 4500);
}

async function updateQueue() {
    const data = await fetchSpotify('/me/player/queue');
    const list = document.getElementById('queue-list');
    if (data && data.queue) {
        list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    }
}

// --- INIT ---
document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
const code = new URLSearchParams(window.location.search).get("code");
if (code) {
    getAccessToken(code).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        updateQueue();
    });
}
if (localStorage.getItem('access_token')) {
    updateQueue();
    setInterval(updateQueue, 30000);
}
