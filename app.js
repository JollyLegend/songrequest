const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const clientSecret = '1ccfd8f5d6a44e3da62892c7daf2ed32';
const redirectUri = 'https://jollylegend.github.io/songrequest/';

// --- PASTE NEW REFRESH TOKEN HERE ---
const permanentRefreshToken = "AQBfB8oQJDzX8Sj9jQqX7LsWAKBfY_9LDmYUNAoCeZoenXJeaOskKvKmrJcmcIhtUdcF7aVI1_XI2u__6yyHXrLMFrllVyExB1gAlasr3ztFzPAaEhvNoUjzGiQHTaAAdgE"; 

// --- 1. PKCE LOGIN LOGIC (To get your new token) ---
async function authorize() {
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

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    window.localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'user-modify-playback-state user-read-playback-state',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// --- 2. HANDLE AUTH REDIRECT ---
const urlParams = new URLSearchParams(window.location.search);
let code = urlParams.get('code');
if (code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    }).then(res => res.json()).then(data => {
        if(data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
            alert("SUCCESS! Copy the refresh_token from Application Tab -> Local Storage");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    });
}

// --- 3. ALWAYS-ON AUTH ---
async function getAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token') || permanentRefreshToken;
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: { 
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });

    const data = await response.json();
    return data.access_token;
}

// --- 4. API CALLS ---
async function fetchWebApi(endpoint, method, body = null) {
    const token = await getAccessToken();
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        method,
        body: body ? JSON.stringify(body) : null
    });
    return res.status === 204 ? null : await res.json();
}

// --- 5. SEARCH & QUEUE ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', async (e) => {
        if (e.target.value.length < 3) return;
        const data = await fetchWebApi(`v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, 'GET');
        if (data && data.tracks) displayResults(data.tracks.items);
    });
}

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
    await fetchWebApi(`v1/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
    document.getElementById('results').innerHTML = "<div style='color:var(--spotify-green); padding:20px;'>✅ Added to queue!</div>";
    searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    const data = await fetchWebApi('v1/me/player/queue', 'GET');
    const list = document.getElementById('queue-list');
    if (data && data.queue) {
        list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    } else {
        list.innerHTML = "<li>Connect Spotify to see queue.</li>";
    }
}

// Update queue every 30 seconds
setInterval(updateQueue, 30000);
updateQueue();
