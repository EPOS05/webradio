const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Array to store information about currently playing stations
const playingStations = [];

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to fetch MP3 files from a JSON URL and store them locally
async function fetchAndStoreMP3Files(jsonUrl) {
    // Fetch JSON file
    const fetch = require('node-fetch');
    const response = await fetch(jsonUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }
    const json = await response.json();
    const mp3Files = json.mp3_files;

    // Create directory to store MP3 files if it doesn't exist
    if (!fs.existsSync('mp3_files')) {
        fs.mkdirSync('mp3_files');
    }

    // Fetch and store MP3 files locally
    mp3Files.forEach(async (mp3Url, index) => {
        const mp3Filename = `mp3_files/audio_${index}.mp3`;
        const fileStream = fs.createWriteStream(mp3Filename);
        const protocol = mp3Url.startsWith('https://') ? https : http;
        protocol.get(mp3Url, (mp3Response) => {
            mp3Response.pipe(fileStream);
        });
    });
}

// Function to create HLS playlist for a channel
function createHLSPlaylist(channelId, res) {
    const mp3Files = fs.readdirSync('mp3_files');
    const shuffledFiles = shuffleArray(mp3Files);

    res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    });
    
    shuffledFiles.forEach((file, index) => {
        const filePath = `mp3_files/${file}`;
        res.write(`#EXTINF:-1,Audio ${index}\n`);
        res.write(`${filePath}\n`);
    });

    res.end();
}

// Route to start playing MP3 files on a new channel
app.get('/start', async (req, res) => {
    const jsonUrl = req.query.json;
    if (!jsonUrl) {
        res.status(400).send('JSON URL not provided.');
        return;
    }

    try {
        // Fetch JSON file
        const fetch = require('node-fetch');
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            res.status(response.status).send('Failed to fetch JSON.');
            return;
        }
        const json = await response.json();
        
        // Check if JSON contains valid MP3 files
        const mp3Files = json.mp3_files;
        if (!mp3Files || !Array.isArray(mp3Files) || mp3Files.length === 0) {
            res.status(400).send('Invalid JSON format or no MP3 files available.');
            return;
        }

        // Fetch and store MP3 files from JSON URL
        await fetchAndStoreMP3Files(jsonUrl);

        // Generate a unique ID for the channel
        const channelId = uuidv4();

        // Add the playing station to the list of playing stations
        playingStations.push({ id: channelId, startTime: new Date() });
        console.log(`New channel created: ID ${channelId}`);

        // Send the HLS playlist to the user
        createHLSPlaylist(channelId, res);
    } catch (error) {
        console.error('Error starting channel:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to list currently playing stations
app.get('/playing', (req, res) => {
    res.json(playingStations);
});

// Route to play the HLS playlist for a channel
app.get('/play', (req, res) => {
    const channelId = req.query.id;
    const existingChannel = playingStations.find(channel => channel.id === channelId);
    if (!existingChannel) {
        res.status(404).send('Channel not found.');
        return;
    }

    createHLSPlaylist(channelId, res);
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
