const express = require('express');
const fs = require('fs');
const http = require('http');
const { Readable } = require('stream');

const app = express();

app.get('/play', (req, res) => {
    const mp3Url = req.query.json;
    if (!mp3Url) {
        return res.status(400).send('JSON URL not provided.');
    }

    fetchMP3FilesJSON(mp3Url)
        .then(mp3Files => {
            if (mp3Files.length === 0) {
                return res.status(400).send('No MP3 files available.');
            }

            res.status(200).set({
                'Content-Type': 'audio/mpeg',
                'Connection': 'keep-alive',
                'Transfer-Encoding': 'chunked'
            });

            streamMP3Files(mp3Files, res);
        })
        .catch(error => {
            console.error('Error fetching MP3 files JSON:', error);
            res.status(500).send('Internal Server Error');
        });
});

function fetchMP3FilesJSON(jsonFileUrl) {
    return new Promise((resolve, reject) => {
        http.get(jsonFileUrl, (response) => {
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
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

function streamMP3Files(mp3Files, res) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const filePath = mp3Files[currentIndex];
        const streamFile = fs.createReadStream(filePath);
        streamFile.on('end', playNext);
        streamFile.pipe(res, { end: false });
        currentIndex++;
    };

    playNext();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
