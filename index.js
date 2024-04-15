const express = require('express');
const http = require('http');
const https = require('https');
const { Readable } = require('stream');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Map to store active channels
const activeChannels = new Map();

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to stream MP3 files
function streamMP3Files(mp3Files, res) {
    const shuffledFiles = shuffleArray([...mp3Files]); // Shuffle the array of files

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= shuffledFiles.length) {
            // Loop back to the beginning of the shuffled list
            currentIndex = 0;
            shuffleArray(shuffledFiles); // Reshuffle the list for next iteration
        }

        const filePath = shuffledFiles[currentIndex];
        
        // Determine the protocol (HTTP or HTTPS) and use the appropriate module
        const protocol = filePath.startsWith('https://') ? https : http;

        // If the file path is a URL, stream it directly
        const request = protocol.get(filePath, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                currentIndex++;
                playNext();
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
            res.end(); // End the response stream on error
        });

        // Remove event listener when response stream ends or on error
        const onClose = () => {
            res.removeListener('close', onClose);
            request.abort();
        };

        res.on('close', onClose);
        request.on('close', onClose);
    };

    playNext();
}

// Middleware to parse JSON body
app.use(express.json());

// Route to start a new channel
app.get('/start', (req, res) => {
    const jsonUrl = req.query.json;

    if (!jsonUrl) {
        return res.status(400).send('JSON URL not provided.');
    }

    // Fetch MP3 files from JSON URL
    const protocol = jsonUrl.startsWith('https://') ? https : http;
    protocol.get(jsonUrl, (response) => {
        if (response.statusCode !== 200) {
            console.error('Error fetching JSON:', response.statusCode);
            return res.status(response.statusCode).send('Error fetching JSON');
        }

        let data = '';
        response.on('data', chunk => {
            data += chunk;
        });
        response.on('end', () => {
            try {
                const json = JSON.parse(data);
                const mp3Files = json.mp3_files;
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
                console.error('Error parsing JSON:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }).on('error', (error) => {
        console.error('Error fetching JSON:', error);
        res.status(500).send('Internal Server Error');
    });
});

// Route to play an existing channel
app.get('/play', (req, res) => {
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
