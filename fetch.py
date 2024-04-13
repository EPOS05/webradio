import os
import json
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TPE1, TALB, TDRC

# Define the folder path containing the MP3 files
folder_path = 'mp3/'
img_folder_path = 'img/'

# Create the 'img' folder if it doesn't exist
if not os.path.exists(img_folder_path):
    os.makedirs(img_folder_path)

# Get a list of all files in the folder
files = os.listdir(folder_path)

# Filter the list to include only MP3 files
mp3_files = [folder_path + file for file in files if file.lower().endswith('.mp3')]

# Create a list to store dictionaries for each MP3 file
mp3_list = []

# Iterate over each MP3 file
for mp3_file in mp3_files:
    # Open the MP3 file and extract metadata
    audio = MP3(mp3_file, ID3=ID3)

    # Extract basic metadata
    title = audio.get('TIT2', [''])[0]
    artist = audio.get('TPE1', [''])[0]
    album = audio.get('TALB', [''])[0]
    year = audio.get('TDRC', [''])[0]

    # Extract cover art if available
    cover_art_path = None
    for tag in audio.tags.values():
        if isinstance(tag, APIC):
            cover_art = tag.data
            # Save cover art to the 'img' folder
            cover_art_path = os.path.join(img_folder_path, os.path.splitext(os.path.basename(mp3_file))[0] + '.jpg')
            with open(cover_art_path, 'wb') as img_file:
                img_file.write(cover_art)
            break  # Stop after extracting the first cover art

    # Create dictionary with metadata and cover art path
    mp3_data = {
        'file_path': mp3_file,
        'title': title,
        'artist': artist,
        'album': album,
        'year': year,
        'cover_art_path': cover_art_path
    }

    # Add dictionary to the list
    mp3_list.append(mp3_data)

# Write the list to a JSON file
with open('mp3_files.json', 'w') as json_file:
    json.dump({'mp3_files': mp3_list}, json_file, indent=4)

print('JSON file generated successfully.')
