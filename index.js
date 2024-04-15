const express = require('express');
const axios = require('axios');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Map to store active channels
const activeChannels = new Map();

// Function to stream MP3 files
async function streamMP3Files(mp3Files, res) {
    let currentIndex = 0;

    const playNext = async () => {
        if (currentIndex >= mp3Files.length) {
            currentIndex = 0; // Restart from the beginning
        }

        const filePath = mp3Files[currentIndex];
        
        try {
            const response = await axios.get(filePath, { responseType: 'stream' });
            response.data.pipe(res, { end: false });
            response.data.on('end', () => {
                currentIndex++;
                playNext();
            });
        } catch (error) {
            console.error('Error streaming file:', error.message);
            res.end(); // End the response stream on error
        }
    };

    playNext();
}

// Route to start a new channel
app.get('/start', async (req, res) => {
    const jsonUrl = req.query.json;

    if (!jsonUrl) {
        return res.status(400).send('JSON URL not provided.');
    }

    try {
        const response = await axios.get(jsonUrl);
        const mp3Files = response.data.mp3_files;
        if (!mp3Files || !Array.isArray(mp3Files) || mp3Files.length === 0) {
            return res.status(400).send('Invalid JSON format or no MP3 files available.');
        }

        // Generate unique channel ID
        const channelId = uuidv4();
        // Store channel ID and MP3 files in active channels map
        activeChannels.set(channelId, mp3Files);
        // Start streaming MP3 files on the channel
        streamMP3Files(mp3Files, res);
        // Log the creation of the new channel
        console.log(`New channel created: ${channelId}`);
        // Send the channel ID to the user
        res.status(200).send(`Channel created: ${req.protocol}://${req.get('host')}/play?id=${channelId}`);
    } catch (error) {
        console.error('Error fetching JSON:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Route to play an existing channel
app.get('/play', async (req, res) => {
    const channelId = req.query.id;
    const mp3Files = activeChannels.get(channelId);
    if (!mp3Files) {
        return res.status(404).send('Channel not found.');
    }
    res.status(200).set({
        'Content-Type': 'audio/mpeg',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
    });
    streamMP3Files(mp3Files, res);
});

// Route to stop and delete a channel
app.get('/stop', (req, res) => {
    const channelId = req.query.id;
    if (!channelId) {
        return res.status(400).send('Channel ID not provided.');
    }
    if (!activeChannels.has(channelId)) {
        return res.status(404).send('Channel not found.');
    }
    // Remove the channel from active channels map
    activeChannels.delete(channelId);
    console.log(`Channel stopped and deleted: ${channelId}`);
    res.status(200).send('Channel stopped and deleted.');
});

// Route to get a list of all active channels
app.get('/playing', (req, res) => {
    const channels = Array.from(activeChannels.keys()).map(channelId => `${req.protocol}://${req.get('host')}/play?id=${channelId}`);
    res.status(200).json(channels);
});

// Route to handle the root URL
app.get('/', (req, res) => {
    res.status(200).send('Welcome! Please provide the URL of a JSON file to start a new channel.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
