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
  <strong>Terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI aracı.</strong>
</p>

<p align="center">
  <a href="README-EN.md">🇬🇧 English</a>
</p>

## Özellikler

- **Çoklu Kaynak Desteği:** Türkçe (Animely.net, Animecix.tv) ve İngilizce (AllAnime) kaynaklar
- **Çoklu Dil:** Türkçe ve İngilizce arayüz desteği
- **Dil Bazlı Kaynak Filtreleme:** Seçtiğiniz dile göre otomatik kaynak filtreleme
- **Sub/Dub Desteği:** AllAnime'de altyazılı veya dublajlı izleme seçeneği
- **Anında İzleme:** VLC veya MPV ile doğrudan streaming
- **Kaldığı Yerden Devam:** MPV ile izlerken kaldığınız dakikayı otomatik hatırlar
- **Kalite Seçimi:** Animecix ve AllAnime'de çoklu kalite seçenekleri
- **Anilist Entegrasyonu:** İzlediğiniz animeleri otomatik olarak Anilist'e ekleyin
- **Discord Rich Presence:** Ne izlediğiniz Discord profilinizde görünsün
- **Akıllı İndirme:** Kaldığı yerden devam, kuyruk sistemi, eşzamanlı indirme
- **Aria2 Desteği:** MP4 indirmelerinde 16x bağlantı ile hızlı indirme
- **yt-dlp Desteği:** M3U8 indirmelerinde paralel bağlantı ile hızlı indirme
- **Son İzlenen İşaretleme:** Bölüm listesinde son izlediğiniz ve sıradaki bölüm işaretli

## Görseller

| Menü | Ayarlar |
|------|---------|
| ![menü](https://r2.fakecrime.bio/uploads/10b1f77e-f967-45bf-9a74-e4c539c52dfe.png) | ![ayarlar](https://r2.fakecrime.bio/uploads/6a01a11a-309c-4d3a-8d40-04ed81e4476b.png) |

| Arama | Anime |
|-------|-------|
| ![arama](https://r2.fakecrime.bio/uploads/95ff108b-dc25-44a2-a51a-1457b35ce99c.png) | ![anime](https://r2.fakecrime.bio/uploads/4f92ad64-056e-4661-bc3a-d7e9def1793f.png) |

## Desteklenen Kaynaklar

| Kaynak | Dil | Arama | İzleme | İndirme | Kalite Seçimi | Sub/Dub |
|--------|-----|-------|--------|---------|---------------|---------|
| Animely.net | 🇹🇷 Türkçe | ✅ Fuzzy Search | ✅ | ✅ | - | - |
| Animecix.tv | 🇹🇷 Türkçe | ✅ API Search | ✅ | ✅ | ✅ 480p/720p/1080p | - |
| AllAnime | 🇬🇧 İngilizce | ✅ API Search | ✅ | ✅ | ✅ Çoklu | ✅ |

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

## Kullanım

```bash
animely
```

## İndirme Yöneticileri

### Aria2 (MP4 için)
MP4 dosyaları için hızlı indirme. Ayarlardan etkinleştirin, otomatik kurulur.

### yt-dlp (M3U8 için)
M3U8/HLS stream'leri için hızlı indirme. Ayarlardan etkinleştirin, otomatik kurulur.

## Web Versiyonu

iOS ve Android cihazlarda web üzerinden de kolayca kullanabilirsiniz:

| Animely | Web |
|-------|-------|
| ![animely](https://r2.fakecrime.bio/uploads/fe9a4785-77da-4203-ad22-74cb6b171aec.png) | ![web](https://r2.fakecrime.bio/uploads/97391eca-3ab0-483d-86e6-0d199be45bde.png) |

**[animely.ewgsta.me](https://animely.ewgsta.me)**

## Gereksinimler

### CLI
- **Node.js** v18+
- **Video Oynatıcı:** MPV (önerilen) veya VLC

### Opsiyonel
- **Aria2:** Hızlı MP4 indirme (otomatik kurulur)
- **yt-dlp:** Hızlı M3U8 indirme (otomatik kurulur)

### Web
- **Discord hesabı**
- **İnternet**

## Katkıda Bulunun

1. Fork'layın
2. Feature branch oluşturun (`git checkout -b yeni-ozellik`)
3. Değişikliklerinizi commit'leyin (`git commit -m 'Yeni özellik eklendi'`)
4. Branch'inizi push'layın (`git push origin yeni-ozellik`)
5. Pull Request açın

### Geliştirme

```bash
git clone https://github.com/ewgsta/animely.git
cd animely
pnpm install
pnpm start
```

## Destek

- **Bug Report:** [GitHub Issues](https://github.com/ewgsta/animely/issues)
- **Özellik İsteği:** [GitHub Issues](https://github.com/ewgsta/animely/issues)

## Lisans

Bu proje [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) lisansı ile lisanslanmıştır.

- **Paylaş:** Eseri her ortam veya formatta kopyalayabilir ve yeniden dağıtabilirsiniz.
- **Atıf:** Uygun referans vermeli, lisansa bağlantı sağlamalı ve değişiklik yapıldıysa bilgi vermelisiniz.
- **Ticari Olmayan:** Bu materyali ticari amaçlarla kullanamazsınız.
- **Türetilemez:** Değiştirilmiş materyali dağıtamazsınız.
