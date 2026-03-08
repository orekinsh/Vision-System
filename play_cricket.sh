#!/bin/bash
# Cricket Stream Player - Curated from iptv-org/iptv
# Streams for India cricket matches (Star Sports, Sony Sports, DD Sports)

PLAYLIST="$(dirname "$0")/cricket_streams.m3u"

echo "=========================================="
echo "  Cricket Stream Player"
echo "  Streams sourced from iptv-org/iptv"
echo "=========================================="
echo ""
echo "Available channels:"
echo ""
echo "--- Star Sports (Primary Cricket Broadcaster) ---"
echo "  1) Star Sports 1 HD (1080p)"
echo "  2) Star Sports 1 Hindi (576p)"
echo "  3) Star Sports 1 Hindi HD (1080p)"
echo "  4) Star Sports 1 Tamil HD (1080p)"
echo "  5) Star Sports 1 Telugu HD (1080p)"
echo "  6) Star Sports 2 HD (1080p)"
echo "  7) Star Sports 2 Hindi HD (1080p)"
echo "  8) Star Sports 3 (576p)"
echo "  9) Star Sports Select 1 HD (1080p)"
echo " 10) Star Sports Select 2 HD (1080p)"
echo ""
echo "--- Sony Sports ---"
echo " 11) Sony Sports Ten 1 HD (1080p)"
echo " 12) Sony Sports Ten 2 HD (1080p)"
echo " 13) Sony Sports Ten 3 Hindi (576p)"
echo " 14) Sony Sports Ten 5 HD (1080p)"
echo ""
echo "--- DD Sports (Free-to-Air) ---"
echo " 15) DD Sports (CloudFront CDN)"
echo " 16) DD Sports (Tango)"
echo " 17) DD Sports (PiShow)"
echo " 18) DD Sports HD (Alt)"
echo ""
echo "--- International ---"
echo " 19) Willow Sports (US Only)"
echo " 20) Ten Sports Pakistan"
echo ""
echo "  0) Open full playlist in VLC"
echo ""

# Stream URLs array
URLS=(
    ""  # placeholder for index 0
    "http://103.229.254.25:7001/play/a0a0/index.m3u8"           # 1
    "http://161.248.38.40:8000/play/a071/index.m3u8"            # 2
    "http://161.248.38.40:8000/play/a06n/index.m3u8"            # 3
    "http://111.88.78.21:8000/play/a0to/index.m3u8"             # 4
    "http://111.88.78.21:8000/play/a0vc/index.m3u8"             # 5
    "http://103.121.6.5:8000/play/a05u/index.m3u8"              # 6
    "http://103.113.103.202:8001/play/a028/index.m3u8"          # 7
    "http://103.121.6.5:8000/play/a05y/index.m3u8"              # 8
    "http://103.113.103.202:8001/play/a02e/index.m3u8"          # 9
    "http://103.113.103.202:8001/play/a02q/index.m3u8"          # 10
    "http://103.121.6.5:8000/play/a05w/index.m3u8"              # 11
    "http://103.229.254.25:7001/play/a02t/index.m3u8"           # 12
    "http://103.229.254.25:7001/play/a09q/index.m3u8"           # 13
    "http://103.229.254.25:7001/play/a0dw/index.m3u8"           # 14
    "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8"  # 15
    "https://mumt02.tangotv.in/DDSPORTS/index.m3u8"             # 16
    "https://cdn-6.pishow.tv/live/13/master.m3u8"               # 17
    "http://103.78.149.54:8000/play/a02i/index.m3u8"            # 18
    "https://amg01269-amg01269c1-distrotv-us-5379.playouts.now.amagi.tv/playlist/amg01269-willowtvfast-willowplus-distrotvus/playlist.m3u8"  # 19
    "http://121.91.61.106:8000/play/a04h/index.m3u8"            # 20
)

read -p "Select channel (0-20): " choice

if [ "$choice" = "0" ]; then
    echo "Opening full cricket playlist..."
    if command -v vlc &> /dev/null; then
        vlc "$PLAYLIST" &
    elif command -v mpv &> /dev/null; then
        mpv --playlist="$PLAYLIST"
    elif command -v ffplay &> /dev/null; then
        echo "ffplay doesn't support playlists. Please install VLC or mpv."
    else
        echo "No supported player found. Install VLC or mpv."
        echo "Playlist file: $PLAYLIST"
    fi
    exit 0
fi

if [ "$choice" -ge 1 ] && [ "$choice" -le 20 ] 2>/dev/null; then
    URL="${URLS[$choice]}"
    echo ""
    echo "Playing stream: $URL"
    echo ""
    if command -v mpv &> /dev/null; then
        mpv "$URL"
    elif command -v vlc &> /dev/null; then
        vlc "$URL" &
    elif command -v ffplay &> /dev/null; then
        ffplay "$URL"
    else
        echo "No supported player found. Install VLC, mpv, or ffplay."
        echo "Stream URL: $URL"
        echo ""
        echo "You can also paste this URL directly into VLC:"
        echo "  Media > Open Network Stream > $URL"
    fi
else
    echo "Invalid selection."
fi
