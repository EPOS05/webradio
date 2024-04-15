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
        const response = await protocol.get(mp3Url);
        response.pipe(fileStream);
    });
}

// Function to stream MP3 files
function streamMP3Files(channelId, res) {
    const mp3Files = fs.readdirSync('mp3_files');

    // Shuffle array of MP3 files
    const shuffledFiles = shuffleArray(mp3Files);

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= shuffledFiles.length) {
            // Loop back to the beginning of the shuffled list
            currentIndex = 0;
            shuffleArray(shuffledFiles); // Reshuffle the list for next iteration
        }

        const filePath = `mp3_files/${shuffledFiles[currentIndex]}`;

        // Stream MP3 file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res, { end: false });
        fileStream.on('end', () => {
            currentIndex++;
            playNext();
        });
    };

    // Start streaming MP3 files
    playNext();

    // Add the playing station to the list of playing stations
    playingStations.push({ id: channelId, startTime: new Date() });

    // Log the creation of a new channel
    console.log(`New channel created: ID ${channelId}`);
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

        // Check if MP3 files are playable
        for (const mp3Url of mp3Files) {
            const protocol = mp3Url.startsWith('https://') ? https : http;
            const response = await protocol.head(mp3Url);
            if (response.statusCode !== 200 || !response.headers['content-type'].startsWith('audio/')) {
                res.status(400).send('Invalid MP3 file format or URL.');
                return;
            }
        }

        // Fetch and store MP3 files from JSON URL
        await fetchAndStoreMP3Files(jsonUrl);

        // Generate a unique ID for the channel
        const channelId = uuidv4();

        // Start streaming MP3 files on the new channel
        streamMP3Files(channelId, res);

        // Construct the URL for the user
        const baseUrl = req.protocol + '://' + req.get('host');
        const channelUrl = `${baseUrl}/channel/${channelId}`;

        // Send the channel URL to the user
        res.status(200).send(`Channel URL: ${channelUrl}`);
    } catch (error) {
        console.error('Error starting channel:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to stop a playing station
app.get('/stop', (req, res) => {
    const channelId = req.query.id;
    if (!channelId) {
        res.status(400).send('Channel ID not provided.');
        return;
    }

    // Find the playing station by its ID
    const stationIndex = playingStations.findIndex(station => station.id === channelId);
    if (stationIndex === -1) {
        res.status(404).send('Playing station not found.');
        return;
    }

    // Remove the playing station from the list of playing stations
    playingStations.splice(stationIndex, 1);

    // Log that the station has been stopped
    console.log(`Station with ID ${channelId} has been stopped.`);

    res.status(200).send(`Station with ID ${channelId} has been stopped.`);
});

// Route to see currently playing stations
app.get('/playing', (req, res) => {
    res.status(200).json(playingStations);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
