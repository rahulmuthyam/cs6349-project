#!/bin/bash

cd "$(dirname "${BASH_SOURCE[0]}")"

# Cleanup
rm -rf ./temp
mkdir ./temp

# Run Server
./run.sh server &
sleep 5

# Client Upload
./run.sh upload ./files/archive.zip
./run.sh upload ./files/img.jpg
./run.sh upload ./files/text.txt
./run.sh upload ./files/vid.mp4

# Client Download
./run.sh download ./temp/archive.zip
./run.sh download ./temp/img.jpg
./run.sh download ./temp/text.txt
./run.sh download ./temp/vid.mp4

# Kill all child processes
echo -e "\nKilling all child processes..."
kill 0
exit 0