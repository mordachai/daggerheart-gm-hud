[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/W7W01A1ZN1)

![Static Badge](https://img.shields.io/badge/Foundry_VTT-14-blue?style=for-the-badge) ![Github All Releases](https://img.shields.io/github/downloads/mordachai/daggerheart-gm-hud/total.svg?style=for-the-badge) ![GitHub Release](https://img.shields.io/github/v/release/mordachai/daggerheart-gm-hud?display_name=tag&style=for-the-badge&label=Current%20version)

# Daggerheart GM HUD

A streamlined HUD for Game Masters running Daggerheart sessions, providing quick access to adversary information and actions without cluttering the interface.

<img width="704" height="589" alt="image" src="https://github.com/user-attachments/assets/569ea625-be40-49c0-b9a4-c3c9aedbe13c" />

https://github.com/user-attachments/assets/8256bc3f-ae30-45b0-b933-dc727646f66b

## What's New in 2.0.0

Mega update — big refactor + new capabilities:

- **Two Column Layout**: Features panel can show two columns for more info at a glance (toggle back to one column in Settings)
- **Daggerheart: Distances integration**: range/reach visualization now delegates to the [Daggerheart: Distances](https://github.com/) module's ring API instead of drawing custom templates — install that module to use range buttons
- **Spend Fear from the HUD**: adjust the world Fear pool directly, less mouse travel around
- **Utility Belt slots with Features**: drag items/features into slots, right-click a slot to clear it, drag-and-drop to rearrange
- **Theme Selector & Lock Position**: right-click the portrait for a context menu — cycle themes and lock the HUD in place without leaving the HUD

<img width="383" height="333" alt="image" src="https://github.com/user-attachments/assets/e2c18bb2-f58c-4aec-b7c9-0423aaebcb33" />

- Codebase rewritten from one 1,200+ line file into focused modules (`system/`, `hud/`, `hud/context/`) — rolls, damage, and chat now go through the real Daggerheart system API instead of hand-rolled logic:
  - Shift/Alt/Ctrl-click on the attack icon now skips/modifies the roll config dialog, same as the rest of the system
  - "Send to chat" produces the system's real ability card
  - Damage rolls correctly apply active-effect damage bonuses (attack and damage are one system action now, so the separate damage button was removed)
  - Reaction rolls verified against the system's own reaction-roll config
  - Removed dead code paths that never matched the current Daggerheart system API

## HUD Mouse Controls:

### On the Core (Portrait Area):
- **Click n' drag:** moves HUD around the screen
- **Double click:** opens the adversary's character sheet
- **Right click:** opens context menu — toggle conditions, lock/unlock position, cycle theme

### On the Resources (Left Side):
- **Reaction Roll Button:** Click to roll a reaction for the adversary
- **HP & Stress:** Left-click = **+1**, Right-click = **-1**
- **Fear:** Adjust the shared world Fear pool directly from the HUD
- **Difficulty:** Displays the adversary's difficulty rating

### On the Attack (Right Side):
- **Attack Icon:** Click to roll the adversary's primary attack (Shift/Alt/Ctrl-click to skip/modify the roll config dialog)
- Shows attack bonus, range, damage, and damage type

### Features Panel:
- **Features Button:** Toggle to open/close the features panel
- **Feature Icons:** Click to execute feature actions (if available)
- **Chat Button:** Send feature description to chat
- **Panel:** Automatically positions above or below the HUD based on available screen space, one or two columns depending on Settings

### Utility Belt:
- **Click:** execute the slotted item/feature
- **Right-click:** clear a slot
- **Drag and drop:** rearrange slots, or drag in a new item/feature
- **+ button:** add another slot

## Features

- **Compact Layout**: Essential adversary information in a minimal interface
- **Smart Positioning**: HUD remembers its position and features panel adapts to screen boundaries
- **Quick Actions**: One-click access to attacks, reactions, and resource adjustments
- **Feature Management**: Browse and execute adversary features with detailed descriptions
- **Utility Belt**: Customizable slots for quick-access items and features, with drag-and-drop rearranging
- **Draggable Interface**: Position the HUD anywhere on screen for optimal workflow, with an option to lock it in place
- **Theme Support**: Multiple color themes to match your campaign aesthetic, switchable from a right-click menu
- **Ring Customization**: Custom portrait frames and scaling options
- **Range Visualization**: Optional integration with the Daggerheart: Distances module for on-canvas range rings

## GM Workflow

1. **Select an adversary token** - The HUD automatically appears for GM users
2. **Quick resource tracking** - Adjust HP/Stress/Fear with simple clicks
3. **Roll attacks and reactions** - Single-click combat actions, modifier-click for fast rolls
4. **Access features** - Toggle the features panel for special abilities
5. **Move freely** - Drag the HUD to your preferred screen position, or lock it once it's placed

## Settings

### Theme Options:
Choose from multiple color schemes (also available via the portrait's right-click context menu):
- Default (Golden)
- Shadowveil (Purple)
- Ironclad (Blue)
- Wildfire (Orange)
- Frostbite (Cyan)

https://github.com/user-attachments/assets/ee8e4164-1c1d-4b13-9182-5f461c320f8f

<img width="838" height="570" alt="image" src="https://github.com/user-attachments/assets/f7f5c9a2-49d0-428a-9330-c40391c92c54" />

### Ring Frame Customization:
- **Custom Ring Frame**: Upload your own portrait frame image
- **Ring Frame Scale**: Adjust the size of the frame overlay (-25% to +25%)
- **Disable Ring Frames**: don't load any ring, useful if you already use rings on the tokens (i.e., Tokenizer module)

<img width="794" height="696" alt="image" src="https://github.com/user-attachments/assets/55af0288-a3c4-4b9a-a771-e768bc8e68f1" />

## Installation

Go to Add-on Modules and search for _daggerheart gm hud_. Click Install.

OR

Use the link below for a manual installation:

**Manifest URL:**
```
https://raw.githubusercontent.com/mordachai/daggerheart-gm-hud/main/module.json
```

Remember to activate the module in your world.

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
