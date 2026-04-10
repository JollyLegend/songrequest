const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const redirectUri = 'https://jollylegend.github.io/songrequest/';
// This is your master key
const initialCode = "AQBLAZIlcsyXYWaxHjUoPkWZPLJ2-PYoP1SvESSFqLEMqsJLrkt6tFPHKm3ZuPMEZ7baYWpcdh-HnihunTs_p7_8bv0nPtY43G0lKMFWpZCZ7mda8XeJJJ5kbypugP9iNZU";

async function getAccessToken() {
    let refreshToken = localStorage.getItem('refresh_token');
    
    // If we don't have a token yet, we use the initial code to get one
    if (!refreshToken) {
        const codeVerifier = localStorage.getItem('code_verifier');
        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                code: initialCode,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier || "" // PKCE safety
            }),
        });
        const data = await res.json();
        if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('access_token', data.access_token);
            return data.access_token;
        }
    }

    // Standard Refresh Flow
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
    if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        return response.access_token;
    }
    return null;
}

// --- SEARCH & QUEUE LOGIC ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', async (e) => {
        if (e.target.value.length < 3) return;
        let token = localStorage.getItem('access_token') || await getAccessToken();

        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            token = await getAccessToken();
            return; 
        }
        
        const data = await res.json();
        if (data.tracks) displayResults(data.tracks.items);
    });
}

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => `
        <div class="song-card" onclick="addToQueue('${track.uri}')">
            <img src="${track.album.images[2].url}" width="40" alt="album">
            <div class="song-info">
                <span class="song-title">${track.name}</span>
                <span class="song-artist">${track.artists[0].name}</span>
            </div>
        </div>
    `).join('');
}

async function addToQueue(uri) {
    let token = localStorage.getItem('access_token') || await getAccessToken();

    const res = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${uri}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
        token = await getAccessToken();
        return addToQueue(uri);
    }

    document.getElementById('results').innerHTML = "<div style='color:#1DB954; padding: 20px;'>✅ Added! Playing after current song.</div>";
    if(searchInput) searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    let token = localStorage.getItem('access_token') || await getAccessToken();
    if (!token) return;

    try {
        const res = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            token = await getAccessToken();
            return updateQueue();
        }

        const data = await res.json();
        if (data && data.queue) {
            const list = document.getElementById('queue-list');
            list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
        }
    } catch (err) {
        console.log("Queue update failed - play music on Spotify first.");
    }
}

// Global Refresh/Update
updateQueue();
setInterval(updateQueue, 30000);
