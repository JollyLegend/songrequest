const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const redirectUri = 'https://jollylegend.github.io/songrequest/';
const permanentRefreshToken = "AQBfB8oQJDzX8Sj9jQqX7LsWAKBfY_9LDmYUNAoCeZoenXJeaOskKvKmrJcmcIhtUdcF7aVI1_XI2u__6yyHXrLMFrllVyExB1gAlasr3ztFzPAaEhvNoUjzGiQHTaAAdgE"; 

async function getAccessToken() {
    // Check if we already have a valid access token in this session
    let token = localStorage.getItem('access_token');
    if (token) return token;

    // If not, use the Master Refresh Token to get a new one
    const url = "https://accounts.spotify.com/api/token";
    const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: permanentRefreshToken,
            client_id: clientId,
        }),
    };

    try {
        const body = await fetch(url, payload);
        const response = await body.json();
        if (response.access_token) {
            localStorage.setItem('access_token', response.access_token);
            // Tokens expire in 60 mins; we'll clear ours in 50 to stay safe
            setTimeout(() => localStorage.removeItem('access_token'), 50 * 60 * 1000);
            return response.access_token;
        }
    } catch (e) {
        console.error("Auth failed. Ensure your Spotify App is active.");
    }
    return null;
}

// --- SEARCH LOGIC ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', async (e) => {
        if (e.target.value.length < 3) return;
        const token = await getAccessToken();
        if (!token) return;

        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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

// --- QUEUE LOGIC ---
async function addToQueue(uri) {
    const token = await getAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${uri}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
        localStorage.removeItem('access_token');
        return addToQueue(uri);
    }

    document.getElementById('results').innerHTML = "<div style='color:#1DB954; padding: 20px; font-weight:bold;'>✅ Requested! Playing after current song.</div>";
    if(searchInput) searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

async function updateQueue() {
    const token = await getAccessToken();
    if (!token) return;

    try {
        const res = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            localStorage.removeItem('access_token');
            return updateQueue();
        }

        const data = await res.json();
        if (data && data.queue) {
            const list = document.getElementById('queue-list');
            list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
        }
    } catch (err) {
        document.getElementById('queue-list').innerHTML = "<li>Music paused or not playing on Spotify.</li>";
    }
}

// Initial update and background refresh
updateQueue();
setInterval(updateQueue, 30000);
