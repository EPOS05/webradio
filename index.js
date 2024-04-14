const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Readable } = require('stream');

const app = express();

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

    const stream = new Readable({
        read() {}
    });

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
        protocol.get(filePath, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                currentIndex++;
                playNext();
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
        });
    };

    playNext();
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const mp3Url = req.query.mp3;
    const jsonUrl = req.query.json;
    const bufferLength = parseInt(req.query.bufferLength) || 3; // Default buffer length is 3
    
    if (mp3Url) {
        // Stream MP3 file directly
        res.status(200).set({
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked'
        });
        const protocol = mp3Url.startsWith('https://') ? https : http;
        protocol.get(mp3Url, (response) => {
            response.pipe(res);
        }).on('error', (error) => {
            console.error('Error fetching MP3:', error);
            res.status(500).send('Internal Server Error');
        });
    } else if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        const protocol = jsonUrl.startsWith('https://') ? https : http;
        protocol.get(jsonUrl, (response) => {
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
                    // Stream random MP3 immediately
                    const randomIndex = Math.floor(Math.random() * mp3Files.length);
                    const randomFilePath = mp3Files[randomIndex];
                    streamMP3Files([randomFilePath], res);
                    
                    // Shuffle and stream the rest of the files asynchronously
                    const remainingFiles = mp3Files.filter((_, index) => index !== randomIndex);
                    shuffleArray(remainingFiles.slice(0, bufferLength));
                    streamMP3Files(remainingFiles.slice(bufferLength), res);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    res.status(500).send('Internal Server Error');
                }
            });
        }).on('error', (error) => {
            console.error('Error fetching JSON:', error);
            res.status(500).send('Internal Server Error');
        });
    } else {
        res.status(400).send('Neither MP3 URL nor JSON URL provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
