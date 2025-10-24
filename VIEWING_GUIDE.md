# HyperVerge World Clock - Viewing Guide

## Server Status

✅ **HTTP Server is RUNNING**
- Port: `8000`
- Status: Active (PID: 925)
- Access: `http://localhost:8000`

---

## Quick Access URLs

### 1. Main World Clock Application
```
http://localhost:8000/world-clock.html
```
Full-featured world clock with all 10 HyperVerge office locations

### 2. Desktop & Mobile Side-by-Side Demo
```
http://localhost:8000/world-clock-demo.html
```
See both desktop and mobile views simultaneously

### 3. File Browser
```
http://localhost:8000/
```
Browse all files in the Vision-System directory

---

## Viewing Options

### Option 1: Open in Browser (Recommended)

**Linux:**
```bash
xdg-open http://localhost:8000/world-clock.html
```

**Or open any browser and navigate to:**
`http://localhost:8000/world-clock.html`

---

### Option 2: Test Mobile View in Browser

#### Chrome/Edge (Recommended):
1. Open `http://localhost:8000/world-clock.html`
2. Press `F12` to open Developer Tools
3. Press `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (Mac)
4. Select a mobile device from the dropdown:
   - iPhone 12 Pro (390x844)
   - iPhone SE (375x667)
   - Pixel 5 (393x851)
   - Samsung Galaxy S20 (360x800)
   - iPad (768x1024)

#### Firefox:
1. Open `http://localhost:8000/world-clock.html`
2. Press `F12` to open Developer Tools
3. Press `Ctrl+Shift+M` to enter Responsive Design Mode
4. Choose device dimensions

---

### Option 3: Side-by-Side Comparison

Open the demo page to see desktop and mobile views together:
```bash
xdg-open http://localhost:8000/world-clock-demo.html
```

This page shows:
- Left: Desktop view (responsive grid)
- Right: Mobile view (iPhone-style frame)

---

## What You'll See

### Desktop View (Wide Screens):
- **Multi-column grid layout** (up to 3 columns)
- All 10 office clocks visible at once
- Hover effects on clock cards
- Wide, spacious layout

### Tablet View (768px - 1024px):
- **2-column grid layout**
- Cards adjust to medium size
- Scrollable if needed

### Mobile View (< 768px):
- **Single-column stack layout**
- Full-width cards
- Easy vertical scrolling
- Touch-optimized
- Larger tap targets

---

## Testing Checklist

Test the following on both desktop and mobile views:

- [ ] All 10 office locations display correctly
- [ ] Clocks update every second
- [ ] Time shows in 12-hour format with AM/PM
- [ ] Date displays current local date for each office
- [ ] Day of week shows correctly
- [ ] Work status badges show appropriate colors:
  - 🟢 Green = Work Hours (9 AM - 6 PM)
  - 🟠 Orange = After Hours (6 PM - 10 PM)
  - 🔵 Blue = Night Time (10 PM - 9 AM)
- [ ] Cards have smooth hover effects (desktop)
- [ ] Responsive layout adapts to screen size
- [ ] No horizontal scrolling on mobile
- [ ] All text is readable
- [ ] Flags display correctly

---

## Responsive Breakpoints

The app automatically adjusts layout based on screen width:

| Screen Width | Layout | Columns |
|-------------|--------|---------|
| > 1200px | Desktop Large | 3 columns |
| 768px - 1200px | Desktop/Tablet | 2-3 columns |
| < 768px | Mobile | 1 column |

---

## Stopping the Server

When you're done viewing:

```bash
# Find the process
ps aux | grep "http.server"

# Kill the server (replace PID with actual process ID)
kill 925

# Or kill all Python HTTP servers
pkill -f "python3 -m http.server"
```

---

## Screenshots

To take screenshots for documentation:

**Chrome DevTools:**
1. Open mobile device view (`Ctrl+Shift+M`)
2. Press `Ctrl+Shift+P` to open Command Palette
3. Type "screenshot" and select:
   - "Capture full size screenshot" - for entire page
   - "Capture screenshot" - for visible area

---

## Troubleshooting

### Can't access localhost:8000
- Check if server is running: `ps aux | grep http.server`
- Restart server: `python3 -m http.server 8000`
- Try different port: `python3 -m http.server 8080`

### Clocks not updating
- Check JavaScript console for errors (F12 → Console tab)
- Ensure JavaScript is enabled in browser
- Try hard refresh: `Ctrl+Shift+R`

### Layout looks broken
- Clear browser cache
- Try different browser
- Check browser window width

### Times seem incorrect
- Clocks use your system time as base
- Check system time is correct
- Times are converted to each office's timezone automatically

---

## Share on Network (Optional)

To access from other devices on your network:

```bash
# Get your local IP
hostname -I | awk '{print $1}'

# Start server on all interfaces
python3 -m http.server 8000 --bind 0.0.0.0
```

Then access from other devices:
```
http://YOUR_IP_ADDRESS:8000/world-clock.html
```

---

## Demo Features

### Desktop Features:
- Responsive grid layout (auto-fit columns)
- Smooth card hover animations
- Purple gradient background
- Glassmorphism card effect
- Real-time status indicators

### Mobile Features:
- Full-width single column
- Touch-optimized tap targets
- Smooth scrolling
- Responsive typography
- Same features as desktop

### Performance:
- Pure JavaScript (no frameworks)
- < 10KB file size
- No external dependencies
- Updates every 1 second
- Minimal CPU usage

---

## Next Steps

1. **View the app**: Open `http://localhost:8000/world-clock.html`
2. **Test mobile view**: Use browser DevTools responsive mode
3. **See comparison**: Open `http://localhost:8000/world-clock-demo.html`
4. **Explore code**: Open `world-clock.html` to see implementation

Enjoy your HyperVerge Global Office World Clock! 🌍⏰
