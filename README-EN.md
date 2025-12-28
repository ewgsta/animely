<div align="center">
  <img src="https://raw.githubusercontent.com/ewgsta/animely/main/docs/img/phee.png" alt="Animely-chan" width="200">
</div>

<p align="center">
  <a href="https://www.npmjs.com/package/animely">
    <img src="https://img.shields.io/npm/v/animely.svg" alt="npm version">
  </a>
  <a href="https://aur.archlinux.org/packages/animely">
    <img src="https://img.shields.io/aur/version/animely" alt="AUR version">
  </a>
  <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/">
    <img src="https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-blue.svg" alt="License">
  </a>
</p>

<p align="center">
  <strong>A powerful, elegant and simple CLI tool for watching and downloading anime from your terminal.</strong>
</p>

<p align="center">
  <a href="README.md">🇹🇷 Türkçe</a>
</p>

## Features

- **Multiple Sources:** Turkish (Animely.net, Animecix.tv) and English (AllAnime) sources
- **Multi-Language:** Turkish and English interface support
- **Language-Based Source Filtering:** Automatic source filtering based on selected language
- **Sub/Dub Support:** Subbed or dubbed viewing option on AllAnime
- **Instant Streaming:** Direct streaming with VLC or MPV
- **Resume Playback:** Automatically remembers where you left off with MPV
- **Quality Selection:** Multiple quality options on Animecix and AllAnime
- **Anilist Integration:** Automatically add watched anime to your Anilist
- **Discord Rich Presence:** Show what you're watching on your Discord profile
- **Smart Downloads:** Resume downloads, queue system, concurrent downloads
- **Aria2 Support:** Fast MP4 downloads with 16x connections
- **yt-dlp Support:** Fast M3U8 downloads with parallel connections
- **Last Watched Marking:** Last watched and next episode marked in episode list

## Screenshots

| Menu | Settings |
|------|----------|
| ![menu](https://r2.fakecrime.bio/uploads/10b1f77e-f967-45bf-9a74-e4c539c52dfe.png) | ![settings](https://r2.fakecrime.bio/uploads/6a01a11a-309c-4d3a-8d40-04ed81e4476b.png) |

| Search | Anime |
|--------|-------|
| ![search](https://r2.fakecrime.bio/uploads/95ff108b-dc25-44a2-a51a-1457b35ce99c.png) | ![anime](https://r2.fakecrime.bio/uploads/4f92ad64-056e-4661-bc3a-d7e9def1793f.png) |

## Supported Sources

| Source | Language | Search | Watch | Download | Quality Selection | Sub/Dub |
|--------|----------|--------|-------|----------|-------------------|---------|
| Animely.net | 🇹🇷 Turkish | ✅ Fuzzy Search | ✅ | ✅ | ❌ | - |
| Animecix.tv | 🇹🇷 Turkish | ✅ API Search | ✅ | ✅ | ✅ 480p/720p/1080p | - |
| AllAnime | 🇬🇧 English | ✅ API Search | ✅ | ✅ | ✅ Multiple | ✅ |

## Installation

### npm (All platforms)

```bash
npm install -g animely
```

### Arch Linux (AUR)

```bash
yay -S animely
# or
paru -S animely
```

## Usage

```bash
animely
```

## Download Managers

### Aria2 (for MP4)
Fast downloads for MP4 files. Enable in settings, installs automatically.

### yt-dlp (for M3U8)
Fast downloads for M3U8/HLS streams. Enable in settings, installs automatically.

## Web Version

You can also use it on iOS and Android devices via web:

| Animely | Web |
|---------|-----|
| ![animely](https://r2.fakecrime.bio/uploads/fe9a4785-77da-4203-ad22-74cb6b171aec.png) | ![web](https://r2.fakecrime.bio/uploads/97391eca-3ab0-483d-86e6-0d199be45bde.png) |

**[animely.ewgsta.me](https://animely.ewgsta.me)**

## Requirements

### CLI
- **Node.js** v18+
- **Video Player:** MPV (recommended) or VLC

### Optional
- **Aria2:** Fast MP4 downloads (auto-installs)
- **yt-dlp:** Fast M3U8 downloads (auto-installs)

### Web
- **Discord account**
- **Internet**

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push your branch (`git push origin new-feature`)
5. Open a Pull Request

### Development

```bash
git clone https://github.com/ewgsta/animely.git
cd animely
pnpm install
pnpm start
```

## Support

- **Bug Report:** [GitHub Issues](https://github.com/ewgsta/animely/issues)
- **Feature Request:** [GitHub Issues](https://github.com/ewgsta/animely/issues)

## License

This project is licensed under [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/).

- **Share:** You may copy and redistribute the material in any medium or format.
- **Attribution:** You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- **NonCommercial:** You may not use the material for commercial purposes.
- **NoDerivatives:** You may not distribute modified material.
