const express = require('express');
const fs = require('fs');
const https = require('https');
const { Readable } = require('stream');

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
                    resolve(json);
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

// Function to stream MP3 files from JSON
function streamMP3FilesFromJSON(jsonUrl, res) {
    fetchMP3FilesJSON(jsonUrl)
        .then(json => {
            const mp3Files = json.mp3_files;
            if (mp3Files.length === 0) {
                return res.status(400).send('No MP3 files available.');
            }
            // Stream MP3 files
            streamMP3FilesWithMetadata(mp3Files, res);
        })
        .catch(error => {
            console.error('Error fetching MP3 files:', error);
            res.status(500).send('Internal Server Error');
        });
}

// Function to stream MP3 files with metadata
function streamMP3FilesWithMetadata(mp3Files, res) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const mp3File = mp3Files[currentIndex];
        const filePath = mp3File.file;
        const streamFile = fs.createReadStream(filePath);

        // Send ICY headers with metadata
        res.write(`icy-name: ${mp3File.artist} - ${mp3File.title}\n`);
        res.write(`icy-genre: ${mp3File.genre}\n`);
        res.write(`icy-url: ${mp3File.website}\n`);
        res.write(`icy-pub: 1\n`);
        res.write(`Content-Type: audio/mpeg\n`);
        res.write('\n');

        streamFile.on('error', (error) => {
            console.error('Error streaming file:', error);
        });
        streamFile.on('end', playNext);
        streamFile.pipe(res, { end: false });
        currentIndex++;
    };

    playNext();
}

// Route to play MP3 files from JSON
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Stream MP3 files from JSON
        streamMP3FilesFromJSON(jsonUrl, res);
    } else {
        res.status(400).send('JSON URL not provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
