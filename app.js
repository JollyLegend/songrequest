const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const redirectUri = 'https://jollylegend.github.io/songrequest/';

// --- PKCE CRYPTO HELPERS ---
const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

const base64encode = (input) => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(input)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- AUTH FLOW ---
async function redirectToAuthCodeFlow() {
    const verifier = generateRandomString(128);
    const challenge = base64encode(await sha256(verifier));

    localStorage.setItem("code_verifier", verifier);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "user-modify-playback-state user-read-playback-state",
        code_challenge_method: "S256",
        code_challenge: challenge,
    });

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function getAccessToken(code) {
    const verifier = localStorage.getItem("code_verifier");

    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
    });

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token, refresh_token } = await result.json();
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    return access_token;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
    });

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const data = await result.json();
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
}

// --- API FETCH WITH RETRY/ERROR HANDLING ---
async function fetchSpotify(endpoint, method = 'GET', body = null) {
    let token = localStorage.getItem('access_token');
    
    const performFetch = async (accessToken) => {
        return fetch(`https://api.spotify.com/v1${endpoint}`, {
            method,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: body ? JSON.stringify(body) : null
        });
    };

    let response = await performFetch(token);

    // If token expired, refresh and try once more
    if (response.status === 401) {
        token = await refreshAccessToken();
        response = await performFetch(token);
    }

    // Rate Limiting Handle
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 2;
        console.warn(`Rate limited. Retrying in ${retryAfter}s`);
        return null; 
    }

    return response.status === 204 ? null : await response.json();
}

// --- APP LOGIC ---
document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);

const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (code) {
    getAccessToken(code).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        updateQueue();
    });
}

const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const data = await fetchSpotify(`/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`);
    if (data && data.tracks) displayResults(data.tracks.items);
});

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => `
        <div class="song-card" onclick="addToQueue('${track.uri}')">
            <img src="${track.album.images[2].url}" width="40">
            <div class="song-info">
                <span class="song-title">${track.name}</span>
                <span class="song-artist">${track.artists[0].name}</span>
            </div>
        </div>
    `).join('');
}

async function addToQueue(uri) {
    await fetchSpotify(`/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
    document.getElementById('results').innerHTML = "<div style='color:var(--spotify-green); padding:20px;'>✅ Added!</div>";
    searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    const data = await fetchSpotify('/me/player/queue');
    if (data && data.queue) {
        const list = document.getElementById('queue-list');
        list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    }
}

// Auto-refresh queue every 30s if we have a token
if (localStorage.getItem('access_token')) {
    updateQueue();
    setInterval(updateQueue, 30000);
}
