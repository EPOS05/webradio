const express = require('express');
const http = require('http');
const https = require('https');
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
    shuffleArray(mp3Files); // Shuffle the array of files

    const playNext = (index) => {
        if (index >= mp3Files.length) {
            return; // Finished streaming all files
        }

        const filePath = mp3Files[index];

        // Determine the protocol (HTTP or HTTPS) and use the appropriate module
        const protocol = filePath.startsWith('https://') ? https : http;

        // If the file path is a URL, stream it directly
        protocol.get(filePath, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                playNext(index + 1); // Stream the next file
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
            playNext(index + 1); // Move to the next file even if there's an error
        });
    };

    playNext(0); // Start streaming from the first file
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const mp3Url = req.query.mp3;
    const jsonUrl = req.query.json;

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
                    // Stream MP3 files
                    streamMP3Files(mp3Files, res);
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
