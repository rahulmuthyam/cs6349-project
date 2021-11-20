#!/bin/bash

# Check Args
if [ "$#" = 0 ] ; then
    echo 'No arguments supplied'
    exit 1
fi

# Server
if [ "$1" = "server" ] ; then
    echo -e "\n--------------------------------------------"
    echo "Launching Server..."
    ../cli.js server

# Upload
elif [ "$1" = "upload" ] ; then
    echo -e "\n--------------------------------------------"
    echo "Upload '$2'"
    if [[ "$#" -ne 2 ]] ; then
        echo 'provide file to upload'
        exit 2
    fi

    ../cli.js upload $2
    sleep 3

# Download
elif [ "$1" = "download" ] ; then
    echo -e "\n--------------------------------------------"
    echo "Download '$2'"
    if [[ "$#" -ne 2 ]] ; then
        echo 'provide file to download'
        exit 2
    fi

    ../cli.js download $2
    sleep 3
fi
