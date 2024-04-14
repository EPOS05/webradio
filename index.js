const express = require('express');
const http = require('http');
const https = require('https');
const { Readable } = require('stream');
const axios = require('axios');

const app = express();

let mp3Files = []; // Store the list of MP3 files

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to stream MP3 files
function streamMP3Files(res) {
    if (mp3Files.length === 0) {
        res.status(400).send('No MP3 files available.');
        return;
    }

    const shuffledFiles = shuffleArray([...mp3Files]); // Shuffle the array of files

    let currentIndex = 0;
    let intervalID;

    const playNext = () => {
        if (currentIndex >= shuffledFiles.length) {
            // Reload MP3 list and shuffle again
            loadMP3Files();
            return;
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
            // Remove the played file from memory
            mp3Files.splice(mp3Files.indexOf(filePath), 1);
            // Restart streaming when an error occurs
            playNext();
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

// Function to load MP3 files
function loadMP3Files() {
    // Fetch MP3 files from JSON URL
    const jsonUrl = 'https://example.com/mp3_files.json'; // Replace with your JSON URL
    const protocol = jsonUrl.startsWith('https://') ? https : http;
    protocol.get(jsonUrl, (response) => {
        if (response.statusCode !== 200) {
            console.error('Error fetching JSON:', response.statusCode);
            return;
        }

        let data = '';
        response.on('data', chunk => {
            data += chunk;
        });
        response.on('end', () => {
            try {
                const json = JSON.parse(data);
                mp3Files = json.mp3_files || [];
                console.log('MP3 files loaded:', mp3Files.length);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        });
    }).on('error', (error) => {
        console.error('Error fetching JSON:', error);
    });
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    streamMP3Files(res);
});

// Ping endpoint
app.get('/ping', (req, res) => {
    res.status(200).send('Ping received');
    console.log('Ping received to show activity.');
});

// Function to ping the server every 5 minutes
const pingServer = () => {
    setInterval(() => {
        axios.get('https://webradio.onrender.com/ping')
            .then(response => {
                console.log('Ping sent to server to show activity.');
            })
            .catch(error => {
                console.error('Error sending ping to server:', error.message);
            });
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
};

// Start pinging the server
pingServer();

// Load MP3 files initially
loadMP3Files();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
