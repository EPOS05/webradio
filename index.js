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

// Function to concatenate MP3 files into a single stream
function concatenateMP3Files(mp3Files) {
    const streams = mp3Files.map(filePath => {
        // Determine the protocol (HTTP or HTTPS) and use the appropriate module
        const protocol = filePath.startsWith('https://') ? https : http;

        // Return a readable stream for each file
        return protocol.get(filePath);
    });

    // Concatenate all streams into one
    return Readable.from(streams).pipe(new ConcatStream());
}

// ConcatStream class to concatenate multiple streams
class ConcatStream extends Readable {
    constructor(options) {
        super(options);
        this.currentStream = null;
        this.streams = [];
        this.currentIndex = 0;
        this.pushedEOF = false;
    }

    _read(size) {
        if (this.currentStream === null && this.currentIndex < this.streams.length) {
            this.currentStream = this.streams[this.currentIndex++];
            this.currentStream.on('data', (chunk) => {
                if (!this.push(chunk)) {
                    this.currentStream.pause();
                }
            });
            this.currentStream.on('end', () => {
                this.currentStream = null;
                this._read(size);
            });
            this.currentStream.on('error', (error) => {
                this.emit('error', error);
            });
        } else if (this.currentStream === null && !this.pushedEOF) {
            this.push(null);
            this.pushedEOF = true;
        } else if (this.currentStream) {
            this.currentStream.resume();
        }
    }

    addStream(stream) {
        this.streams.push(stream);
    }
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
            if (response.statusCode !== 200) {
                console.error('Error fetching JSON:', response.statusCode);
                res.status(response.statusCode).send('Error fetching JSON');
                return;
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
                        res.status(400).send('Invalid JSON format or no MP3 files available.');
                        return;
                    }
                    // Concatenate MP3 files into a single stream
                    const concatenatedStream = concatenateMP3Files(mp3Files);
                    concatenatedStream.pipe(res);
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
