# HyperVerge Global Office World Clock

A beautiful, real-time world clock web application displaying current times across all HyperVerge office locations worldwide.

## Features

- **Real-time Updates**: Automatically updates every second
- **10 Global Offices**: Displays time for all HyperVerge locations
- **Work Status Indicators**: Shows whether it's work hours, after hours, or night time at each location
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Visual Appeal**: Modern gradient design with smooth animations
- **No Dependencies**: Pure HTML, CSS, and JavaScript - no frameworks required

## Office Locations

| Location | City | Timezone |
|----------|------|----------|
| 🇮🇳 India | Bangalore | Asia/Kolkata (IST) |
| 🇻🇳 Vietnam | Ho Chi Minh City | Asia/Ho_Chi_Minh (ICT) |
| 🇵🇭 Philippines | Manila | Asia/Manila (PST) |
| 🇸🇬 Singapore | Singapore | Asia/Singapore (SGT) |
| 🇮🇩 Indonesia | Jakarta | Asia/Jakarta (WIB) |
| 🇰🇪 Kenya | Nairobi | Africa/Nairobi (EAT) |
| 🇿🇦 South Africa | Johannesburg | Africa/Johannesburg (SAST) |
| 🇺🇸 New York | New York City | America/New_York (EST/EDT) |
| 🇺🇸 South Dakota | Rapid City | America/Denver (MST/MDT) |
| 🇺🇸 San Francisco | San Francisco | America/Los_Angeles (PST/PDT) |

## Usage

### Opening the World Clock

Simply open the `world-clock.html` file in any modern web browser:

**Option 1: Double-click the file**
- Navigate to the Vision-System directory
- Double-click on `world-clock.html`
- It will open in your default browser

**Option 2: From command line**
```bash
# On Linux
xdg-open world-clock.html

# On macOS
open world-clock.html

# On Windows
start world-clock.html
```

**Option 3: Drag and drop**
- Drag the `world-clock.html` file into your browser window

### Work Status Indicators

Each office displays a status badge indicating the current time of day:

- **🟢 Work Hours**: 9:00 AM - 6:00 PM (Green badge)
- **🟠 After Hours**: 6:00 PM - 10:00 PM (Orange badge)
- **🔵 Night Time**: 10:00 PM - 9:00 AM (Blue badge)

## Technical Details

### Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (v90+)
- Firefox (v88+)
- Safari (v14+)
- Opera (v76+)

### How It Works

The application uses JavaScript's built-in `Intl.DateTimeFormat` API to:
1. Convert current time to each office's timezone
2. Format time, date, and day of the week appropriately
3. Update all clocks simultaneously every second
4. Determine work status based on local office hours

### No Server Required

This is a completely client-side application:
- No installation needed
- No server or internet connection required (after initial download)
- All timezone conversions happen in the browser
- Lightweight - single 8KB HTML file

## Customization

To add or modify office locations, edit the `offices` array in the JavaScript section:

```javascript
const offices = [
    {
        name: "Office Name",
        city: "City Name",
        timezone: "Timezone/Identifier",  // IANA timezone
        flag: "🏳️"  // Emoji flag
    },
    // Add more offices here
];
```

### Available Timezones

Use standard IANA timezone identifiers. Common examples:
- `Asia/Tokyo`, `Europe/London`, `America/Chicago`
- Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## Features Breakdown

### Design Elements

- **Gradient Background**: Purple gradient for professional appearance
- **Card Layout**: Each office in its own card with hover effects
- **Grid System**: Responsive grid that adapts to screen size
- **Animations**: Smooth fade-in and slide-up effects on load
- **Typography**: Clear, readable fonts with tabular numbers for aligned digits

### User Experience

- **Instant Load**: No loading screens or delays
- **Visual Hierarchy**: Location names and times prominently displayed
- **Color Coding**: Status badges use intuitive colors
- **Hover Feedback**: Cards lift on hover for interactivity

## Use Cases

- **Global Team Coordination**: Check if colleagues are available
- **Meeting Scheduling**: Find overlapping work hours
- **Status Monitoring**: Quick glance at all office times
- **Office Display**: Deploy on lobby screens or dashboards

## Deployment Options

### 1. Local File
Simply keep the HTML file and open it when needed

### 2. Internal Web Server
Host on your company intranet:
```bash
# Simple Python server
python3 -m http.server 8000
# Then visit: http://localhost:8000/world-clock.html
```

### 3. GitHub Pages
Push to a repository and enable GitHub Pages for public access

### 4. Embed in Dashboard
Use an iframe to embed in existing dashboards:
```html
<iframe src="world-clock.html" width="100%" height="800px"></iframe>
```

## Troubleshooting

**Clocks showing wrong time:**
- Ensure your system clock is correct
- Check browser timezone settings
- Clear browser cache and reload

**Display issues:**
- Update to latest browser version
- Check if JavaScript is enabled
- Try a different browser

**Performance issues:**
- Close other tabs/applications
- Disable browser extensions temporarily

## License

Internal use for HyperVerge offices.

## Support

For issues or feature requests, contact the development team.

---

**Last Updated**: October 2025
**Version**: 1.0.0
