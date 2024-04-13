const express = require('express');
const https = require('https');
const { Readable } = require('stream');
const url = require('url');

const app = express();

// Function to fetch MP3 files JSON
function fetchMP3FilesJSON(jsonFileUrl) {
    return new Promise((resolve, reject) => {
        https.get(jsonFileUrl, (response) => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const mp3Files = json.mp3_files;
                    resolve(mp3Files);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.error('Error fetching JSON:', error);
            reject(error);
        });
    });
}

// Function to stream MP3 files
function streamMP3Files(mp3Files, res, jsonUrl) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const mp3FilePath = mp3Files[currentIndex];
        const mp3Url = url.resolve(jsonUrl, mp3FilePath);
        https.get(mp3Url, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                currentIndex++;
                playNext();
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
            currentIndex++;
            playNext();
        });
    };

    playNext();
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        fetchMP3FilesJSON(jsonUrl)
            .then(mp3Files => {
                if (mp3Files.length === 0) {
                    return res.status(400).send('No MP3 files available.');
                }
                // Stream MP3 files
                streamMP3Files(mp3Files, res, jsonUrl);
            })
            .catch(error => {
                console.error('Error fetching MP3 files:', error);
                res.status(500).send('Internal Server Error');
            });
    } else {
        res.status(400).send('JSON URL not provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
