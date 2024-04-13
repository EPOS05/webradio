import os
import json

# Define the folder path containing the MP3 files
folder_path = 'mp3/'

# Get a list of all files in the folder
files = os.listdir(folder_path)

# Filter the list to include only MP3 files
mp3_files = [folder_path + file for file in files if file.lower().endswith('.mp3')]

# Create a dictionary with the MP3 file names and their locations
mp3_dict = {'mp3_files': mp3_files}

# Write the dictionary to a JSON file
with open('mp3_files.json', 'w') as json_file:
    json.dump(mp3_dict, json_file)

print('JSON file generated successfully.')
