const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const redirectUri = 'https://ishaanjolly.com/songrequest';

// --- PKCE & AUTH LOGIC ---
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

async function authorize() {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    window.localStorage.setItem('code_verifier', codeVerifier);

    const params = {
        response_type: 'code',
        client_id: clientId,
        scope: 'user-modify-playback-state user-read-playback-state',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
    };

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

// --- TOKEN REFRESH LOGIC ---
async function getRefreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        }),
    };

    const body = await fetch(url, payload);
    const response = await body.json();
    localStorage.setItem('access_token', response.access_token);
    if (response.refresh_token) localStorage.setItem('refresh_token', response.refresh_token);
}

// --- HANDLE REDIRECT ---
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
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        window.history.replaceState({}, document.title, "/songrequest");
        updateQueue();
    });
}

// --- SEARCH & QUEUE ---
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const token = localStorage.getItem('access_token');
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    displayResults(data.tracks.items);
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
    const token = localStorage.getItem('access_token');
    await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${uri}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    document.getElementById('results').innerHTML = "✅ Song Requested!";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const res = await fetch('https://api.spotify.com/v1/me/player/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
        await getRefreshToken();
        return updateQueue();
    }
    const data = await res.json();
    const list = document.getElementById('queue-list');
    list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
}

// Refresh token every 45 mins
setInterval(getRefreshToken, 45 * 60 * 1000);
if (localStorage.getItem('access_token')) updateQueue();
