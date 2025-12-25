<div align="center">
  <img src="https://raw.githubusercontent.com/ewgsta/animely/main/docs/img/phee.png" alt="Animely Logo" width="200">


  **Terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI aracı.**
  
  [![npm version](https://img.shields.io/npm/v/animely.svg)](https://www.npmjs.com/package/animely)
  [![AUR version](https://img.shields.io/aur/version/animely)](https://aur.archlinux.org/packages/animely)
  [![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-blue.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)
</div>

## Özellikler

- **Çoklu Kaynak Desteği:** Animely.net ve Animecix.tv kaynaklarından anime izleyebilirsiniz
- **Anında İzleme:** VLC veya MPV ile doğrudan streaming
- **Kaldığı Yerden Devam:** MPV ile izlerken kaldığınız dakikayı otomatik hatırlar
- **Kalite Seçimi:** Animecix'te 480p/720p/1080p seçenekleri
- **Anilist Entegrasyonu:** İzlediğiniz animeleri otomatik olarak Anilist'e ekleyin
- **Discord Rich Presence:** Ne izlediğiniz Discord profilinizde görünsün
- **Akıllı İndirme:** Kaldığı yerden devam, kuyruk sistemi, eşzamanlı indirme
- **Aria2 Desteği:** 16x bağlantı ile hızlı indirme
- **Son İzlenen İşaretleme:** Bölüm listesinde son izlediğiniz ve sıradaki bölüm işaretli

## Görseller

| Menü | Ayarlar |
|------|---------|
| ![menü](https://r2.fakecrime.bio/uploads/10b1f77e-f967-45bf-9a74-e4c539c52dfe.png) | ![ayarlar](https://r2.fakecrime.bio/uploads/6a01a11a-309c-4d3a-8d40-04ed81e4476b.png) |

| Arama | Anime |
|-------|-------|
| ![arama](https://r2.fakecrime.bio/uploads/95ff108b-dc25-44a2-a51a-1457b35ce99c.png) | ![anime](https://r2.fakecrime.bio/uploads/4f92ad64-056e-4661-bc3a-d7e9def1793f.png) |

## Desteklenen Kaynaklar

| Kaynak | Arama | İzleme | İndirme | Kalite Seçimi |
|--------|-------|--------|---------|---------------|
| Animely.net | ✅ Fuzzy Search | ✅ | ✅ | ❌ |
| Animecix.tv | ✅ API Search | ✅ | ✅ | ✅ 480p/720p/1080p |

## Kurulum

### npm (Tüm platformlar)

```bash
npm install -g animely
```

### Arch Linux (AUR)

```bash
yay -S animely
# veya
paru -S animely
```

### Gereksinimler

- **Node.js** v18+ 
- **Video Oynatıcı:** MPV (önerilen) veya VLC

## Kullanım

```bash
animely
```


## Ayarlar

Ana menüden "Ayarlar" seçeneğine giderek:
- Anime kaynağını değiştirebilirsiniz
- Video oynatıcısını seçebilirsiniz
- Eşzamanlı indirme sayısını ayarlayabilirsiniz
- İndirme klasörünü özelleştirebilirsiniz
- Anilist hesabınızı bağlayabilirsiniz

> Ayarlar `~/.animely/` klasöründe saklanır.

## Lisans

[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) - Ticari olmayan kullanım, değişiklik yapılamaz.
