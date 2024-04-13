import os
import json
import base64
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC

def extract_metadata(mp3_folder):
    metadata_list = []
    for root, dirs, files in os.walk(mp3_folder):
        for file in files:
            if file.endswith(".mp3"):
                file_path = os.path.join(root, file)
                audio = MP3(file_path, ID3=ID3)
                tags = audio.tags
                metadata = {
                    "file": file_path,
                    "title": tags.get("TIT2", [""])[0],
                    "artist": tags.get("TPE1", [""])[0],
                    "album": tags.get("TALB", [""])[0],
                    "genre": tags.get("TCON", [""])[0],
                    # Extract album art
                    "album_art": extract_album_art(audio),
                    # Add more fields as needed
                }
                metadata_list.append(metadata)
    return {"mp3_files": metadata_list}  # Wrap metadata_list in 'mp3_files' key

def extract_album_art(audio):
    for tag in audio.tags.values():
        if isinstance(tag, APIC):
            # Encode album art data to Base64
            return base64.b64encode(tag.data).decode('utf-8')

if __name__ == "__main__":
    mp3_folder = "mp3/"
    output_file = "metadata.json"
    metadata = extract_metadata(mp3_folder)
    with open(output_file, "w") as f:
        json.dump(metadata, f, indent=4)
    print(f"Metadata saved to {output_file}")
