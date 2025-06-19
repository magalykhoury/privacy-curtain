# Privacy Curtain Browser Extension

## Project Overview
A privacy-focused browser extension that provides selective content blurring across multiple platforms including WhatsApp Web, Gmail, Outlook, and Microsoft Teams. Built with React for the popup interface and vanilla JavaScript for content scripts.

## Project Structure

### Core Files
- **src/App.jsx** - Main React component for extension popup UI with platform-specific controls
- **src/main.jsx** - React application entry point  
- **public/content.js** - Content script that applies CSS blur filters to page elements
- **public/background.js** - Service worker for extension lifecycle management
- **public/manifest.json** - Extension configuration (Manifest v3)
- **index.html** - Popup HTML template with Bootstrap Icons
- **vite.config.js** - Vite build configuration

### Assets
- **public/assets/icon-eye.png** - Extension icon (128x128)
- **public/assets/icon-eye.ai** - Source icon file
- **src/popup.css** - Popup styling

## Technology Stack
- **Frontend**: React 19.1.0 + Vite 6.3.5
- **Extension**: Chrome Extensions Manifest v3
- **Styling**: CSS + Bootstrap Icons
- **Build Tool**: Vite with React plugin
- **Linting**: ESLint 9.25.0

## Platform Support
The extension supports content blurring across 4 platforms:

### WhatsApp Web
- Profile images, names, usernames
- Chat messages (last message or all messages)
- Chat names and profile pictures
- Granular control over individual elements

### Gmail
- Sender names and emails
- Subject lines
- Email snippets/previews
- Bulk "blur all" option

### Microsoft Outlook
- Complete email row blurring
- Sender information
- Subject lines and previews

### Microsoft Teams  
- Avatar images
- Display names
- Chat messages and previews
- Individual chat elements

## Key Features

### Platform Detection
- Automatic detection of current active tab platform
- Platform-specific UI sections in popup
- Visual indicators for current page context

### Granular Controls
- Individual toggle switches for each blur type
- Master toggles for complete platform blurring  
- Persistent settings via Chrome storage API

### CSS Blur Implementation
- Dynamic CSS injection with 5px blur filter
- Hover effects to temporarily reveal content
- Smooth 0.2s transitions
- Platform-specific DOM selectors

### State Management
- Chrome storage sync for cross-device settings
- Real-time communication between popup and content scripts
- Automatic reapplication on page navigation/reload

## Development Commands
```bash
# Development server
npm run dev

# Production build  
npm run build

# Linting
npm run lint

# Preview build
npm run preview
```

## Extension Installation
1. Build the project with `npm run build`
2. Open Chrome/Edge extensions page
3. Enable Developer mode
4. Load unpacked extension from project directory

## Architecture Notes

### Content Script Strategy
- Single content.js file handles all platforms
- Platform detection via hostname analysis
- Mutation observer for dynamic content updates
- History API interception for SPA navigation

### Popup Interface
- React-based with platform tabs
- Bootstrap Icons for visual consistency
- Settings panel for master controls
- Current page detection with visual indicators

### Storage Schema
- Boolean flags for each blur option
- Platform-prefixed naming (e.g., `teams_blurName`)
- Shared Gmail/Outlook configuration

## Testing Considerations
- Test across all supported platforms
- Verify blur persistence on page navigation
- Check hover reveal functionality
- Validate settings synchronization
- Test extension popup responsiveness

## Performance Notes
- Lightweight CSS-only blur implementation
- Debounced DOM observation (500ms)
- Efficient selector targeting
- Minimal memory footprint