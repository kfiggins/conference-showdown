#!/bin/sh
# Double-click to start the game. Keep this window open while you play;
# close it when you're done.
cd "$(dirname "$0")" || exit 1
PORT=8787
( sleep 1; open "http://localhost:$PORT/" ) &
echo "Conference Showdown is running at http://localhost:$PORT/"
echo "Close this window to stop it."
exec python3 -m http.server "$PORT" --bind 127.0.0.1
