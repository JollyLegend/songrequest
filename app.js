const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const clientSecret = '1ccfd8f5d6a44e3da62892c7daf2ed32';
// PASTE YOUR NEW REFRESH TOKEN HERE ONCE YOU GET IT
const permanentRefreshToken = "AQBfB8oQJDzX8Sj9jQqX7LsWAKBfY_9LDmYUNAoCeZoenXJeaOskKvKmrJcmcIhtUdcF7aVI1_XI2u__6yyHXrLMFrllVyExB1gAlasr3ztFzPAaEhvNoUjzGiQHTaAAdgE"; 

// 1. RESTORED ADMIN LOGIN BUTTON
async function authorize() {
    const scopes = 'user-modify-playback-state user-read-playback-state';
    // Using Implicit Grant for the button because it's the easiest way for you to grab a token from the URL/Storage
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent('https://jollylegend.github.io/songrequest/')}`;
    window.location.href = authUrl;
}

// 2. TOKEN MANAGEMENT
async function getAccessToken() {
    // If we have a token in the URL (just logged in), use it!
    const hash = window.location.hash.substring(1).split('&').reduce((initial, item) => {
        if (item) { var parts = item.split('='); initial[parts[0]] = decodeURIComponent(parts[1]); }
        return initial;
    }, {});
    
    if (hash.access_token) {
        localStorage.setItem('access_token', hash.access_token);
        window.location.hash = "";
        return hash.access_token;
    }

    const cachedToken = localStorage.getItem('access_token');
    if (cachedToken) return cachedToken;

    // Fallback to Refresh Token
    const url = "https://accounts.spotify.com/api/token";
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const payload = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: permanentRefreshToken
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: payload
    });

    const data = await response.json();
    if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        return data.access_token;
    }
    return null;
}

// 3. API WRAPPER
async function fetchWebApi(endpoint, method, body = null) {
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        method,
        body: body ? JSON.stringify(body) : null
    });

    if (res.status === 401) {
        localStorage.removeItem('access_token');
        return fetchWebApi(endpoint, method, body);
    }
    return res.status === 204 ? null : await res.json();
}

// 4. SEARCH & RESULTS
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
            <img src="${track.album.images[2].url}" width="40" style="border-radius:4px;">
            <div class="song-info">
                <span class="song-title">${track.name}</span>
                <span class="song-artist">${track.artists[0].name}</span>
            </div>
        </div>
    `).join('');
}

// 5. QUEUE LOGIC
async function addToQueue(uri) {
    await fetchWebApi(`v1/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
    document.getElementById('results').innerHTML = "<div style='color:#1DB954; padding: 20px; font-weight:bold;'>✅ Requested!</div>";
    if(searchInput) searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    const data = await fetchWebApi('v1/me/player/queue', 'GET');
    if (data && data.queue) {
        const list = document.getElementById('queue-list');
        list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    } else {
        document.getElementById('queue-list').innerHTML = "<li>Driver is not playing music.</li>";
    }
}

// Initialize
updateQueue();
setInterval(updateQueue, 30000);
