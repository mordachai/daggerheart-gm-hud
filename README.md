[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/W7W01A1ZN1)

![Static Badge](https://img.shields.io/badge/Foundry_VTT-13-red?style=for-the-badge) ![Github All Releases](https://img.shields.io/github/downloads/mordachai/daggerheart-gm-hud/total.svg?style=for-the-badge) ![GitHub Release](https://img.shields.io/github/v/release/mordachai/daggerheart-gm-hud?display_name=tag&style=for-the-badge&label=Current%20version)

### NOTE: Localization is on the way, only English for now.

# Daggerheart GM HUD

A streamlined HUD for Game Masters running Daggerheart sessions, providing quick access to adversary information and actions without cluttering the interface.

<img width="1130" height="768" alt="image" src="https://github.com/user-attachments/assets/6c2bd102-8e7f-44b5-86ae-d8d63ba2331a" />

## HUD Mouse Controls:

### On the Core (Portrait Area):
- **Click n' drag:** moves HUD around the screen
- **Double click:** opens the adversary's character sheet

### On the Resources (Left Side):
- **Reaction Roll Button:** Click to roll a reaction for the adversary
- **HP & Stress:** Left-click = **+1**, Right-click = **-1**
- **Difficulty:** Displays the adversary's difficulty rating

### On the Attack (Right Side):
- **Attack Icon:** Click to roll the adversary's primary attack
- Shows attack bonus, range, damage, and damage type

### Features Panel:
- **Features Button:** Toggle to open/close the features panel
- **Feature Icons:** Click to execute feature actions (if available)
- **Chat Button:** Send feature description to chat
- **Panel:** Automatically positions above or below the HUD based on available screen space

## Features

- **Compact Layout**: Essential adversary information in a minimal interface
- **Smart Positioning**: HUD remembers its position and features panel adapts to screen boundaries
- **Quick Actions**: One-click access to attacks, reactions, and resource adjustments
- **Feature Management**: Browse and execute adversary features with detailed descriptions
- **Draggable Interface**: Position the HUD anywhere on screen for optimal workflow
- **Theme Support**: Multiple color themes to match your campaign aesthetic
- **Ring Customization**: Custom portrait frames and scaling options

## GM Workflow

1. **Select an adversary token** - The HUD automatically appears for GM users
2. **Quick resource tracking** - Adjust HP/Stress with simple clicks
3. **Roll attacks and reactions** - Single-click combat actions
4. **Access features** - Toggle the features panel for special abilities
5. **Move freely** - Drag the HUD to your preferred screen position

## Settings

### Theme Options:
Choose from multiple color schemes:
- Default (Golden)
- Shadowveil (Purple)
- Ironclad (Blue)
- Wildfire (Orange)
- Frostbite (Cyan)

<img width="838" height="570" alt="image" src="https://github.com/user-attachments/assets/f7f5c9a2-49d0-428a-9330-c40391c92c54" />

### Ring Frame Customization:
- **Custom Ring Frame**: Upload your own portrait frame image
- **Ring Frame Scale**: Adjust the size of the frame overlay (-25% to +25%)
- **Disable Ring Frames**: don't load any ring, useful if you already use rings on the tokens (i.e., Tokenizer module)

<img width="794" height="696" alt="image" src="https://github.com/user-attachments/assets/55af0288-a3c4-4b9a-a771-e768bc8e68f1" />

## Installation

Go to Add-on Modules and search for _daggerheart gm hud_ **<< awaiting Foundry's approval, use manual method below for now**

OR

Use the link below for a manual installation:

**Manifest URL:**
```
https://raw.githubusercontent.com/mordachai/daggerheart-gm-hud/main/module.json
```

## Requirements

- **Foundry VTT v13+**
- **Daggerheart system**
- **GM user permissions** (This module only functions for Game Masters)

## Usage Notes

- The HUD only appears when you select adversary-type actors as a GM
- Multiple adversary selection will show the HUD for the last selected token
- The HUD automatically closes when no adversary tokens are selected
- Features panel intelligently positions itself to avoid covering the main HUD
- All position and theme preferences are saved per-user

## License

MIT License
