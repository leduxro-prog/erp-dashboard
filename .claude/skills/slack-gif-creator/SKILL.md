# Slack GIF Creator Skill Summary

This toolkit helps create animated GIFs optimized for Slack messaging. Here are the key specifications:

## Technical Requirements
**Dimensions:** Emoji GIFs use 128x128 pixels, while message GIFs use 480x480 pixels. Animation settings should maintain 10-30 FPS and keep color palettes between 48-128 colors for optimal file sizes.

## Core Capabilities
The skill provides three main utilities:
- **GIFBuilder** - assembles frames with optimization options
- **Validators** - confirms GIFs meet Slack requirements
- **Easing functions and frame helpers** - smooth animations and common drawing tasks

## Animation Toolkit
Developers can create complex motions by combining concepts like bouncing, pulsing, spinning, fading, and particle effects. The documentation emphasizes using PIL ImageDraw primitives to "draw graphics from scratch" rather than relying on pre-packaged assets.

## Design Philosophy
The skill emphasizes creative, polished graphics over basic placeholders. It recommends using thick outlines, layered shapes, gradients, and careful color selection to achieve professional-looking animations.

**Dependencies:** Pillow, imageio, and numpy

The toolkit is designed for flexibility—it provides knowledge and utilities but expects developers to implement custom animation logic rather than applying rigid templates.