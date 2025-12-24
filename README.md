<div align="center">
  <img src="https://raw.githubusercontent.com/ewgsta/animely/main/docs/img/phee.png" alt="Animely Logo" style="border-radius: 35px; width: 200px; height: auto;">
</div>

**Animely, terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI aracıdır.**

## Özellikler

*   **Çoklu Kaynak Desteği:** Animely.net ve Animecix.tv kaynaklarından anime izleyebilirsiniz.
*   **Anında İzleme:** İndirmeyi beklemeden, doğrudan **VLC Media Player** veya **MPV Player** üzerinden yayın akışı (streaming) yapın.
*   **Kaldığı Yerden Devam:** MPV Player ile izlerken kaldığınız dakikayı otomatik hatırlar ve devam etmenizi önerir.
*   **Kalite Seçimi:** Animecix kaynağında 480p, 720p ve 1080p kalite seçenekleri.
*   **Anilist Entegrasyonu:** İzlediğiniz animeleri Anilist hesabınıza otomatik olarak ekleyin!
*   **Discord Rich Presence (RPC):** Anime izlerken veya menüde gezerken Discord profilinizde ne yaptığınız otomatik olarak gözükür.
*   **Akıllı İndirme Yöneticisi:**
    *   **Kaldığı Yerden Devam Etme:** İnternetiniz kesilse veya program kapansa bile indirmeler kaldığı yerden devam eder.
    *   **Kalıcı Kuyruk:** İndirme kuyruğunuz kaydedilir, programı yeniden başlattığınızda işlemleriniz kaybolmaz.
    *   **Detaylı İstatistikler:** İndirme sırasında anlık hız, indirilen boyut, toplam boyut ve kalan süre (ETA) bilgilerini görün.
*   **Esnek Seçim:** İster tek bir bölümü, ister bir aralığı (örn: 1-12), isterseniz de tüm sezonu tek seferde indirin.
*   **Otomatik Güncelleme:** Yeni bir sürüm çıktığında sizi uyarır ve otomatik olarak günceller.
*   **Gelişmiş Arama:** Animely kaynağında fuzzy search ile anime ismini yazın, en iyi eşleşmeleri anında bulun.
*   **Hızlandırıcı (Aria2):** Desteklenen indirmelerde `aria2c` motorunu kullanarak (16x bağlantı ile) indirmeleri çok daha hızlı yapın.
*   **Kullanıcı Dostu Arayüz:** Renkli, anlaşılır, Türkçe ve etkileşimli menüler.

## Desteklenen Kaynaklar

| Kaynak | Arama | İzleme | İndirme | Kalite Seçimi |
|--------|-------|--------|---------|---------------|
| Animely.net | ✅ Fuzzy Search | ✅ | ✅ | ❌ |
| Animecix.tv | ✅ API Search | ✅ | ✅ | ✅ 480p/720p/1080p |

## Kurulum

Animely'i kullanmak için bilgisayarınızda [Node.js](https://nodejs.org/) yüklü olmalıdır.

Terminalinizi açın ve aşağıdaki komutu çalıştırın:

```bash
npm install -g animely
```

## Kullanım

Kurulum tamamlandıktan sonra, terminale sadece şunu yazmanız yeterli:

```bash
animely
```

İlk açılışta varsayılan video oynatıcınızı (VLC veya MPV) seçmeniz istenecektir.

## Ayarlar

Ana menüden "Ayarlar" seçeneğine giderek:
*   **Anime kaynağını** değiştirebilirsiniz (Animely veya Animecix).
*   Varsayılan video oynatıcısını değiştirebilirsiniz.
*   Eşzamanlı indirme sayısını değiştirebilirsiniz.
*   İndirme klasörünü özelleştirebilirsiniz.

> **Not:** Ayarlar ve indirme kuyruğu dosyanız, kullanıcı ana dizininizde (`~/.animely/`) güvenli bir şekilde saklanır.

## Gereksinimler

*   **Node.js:** Çalıştırma ortamı (v18+ önerilir).
*   **Video Oynatıcı:** "İzle" özelliği için **MPV Player** (önerilen) veya **VLC Media Player** gereklidir. MPV, kaldığı yerden devam özelliğini destekler.

## Lisans

Bu proje [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) lisansı ile lisanslanmıştır.

Bu lisans altında:
*   **Paylaş:** Eseri her ortam veya formatta kopyalayabilir ve yeniden dağıtabilirsiniz.
*   **Atıf:** Uygun referans vermeli, lisansa bağlantı sağlamalı ve değişiklik yapıldıysa bilgi vermelisiniz.
*   **Ticari Olmayan:** Bu materyali ticari amaçlarla kullanamazsınız.
*   **Türetilemez:** Eğer materyali karıştırır, aktarır veya üzerine inşa ederseniz, değiştirilmiş materyali dağıtamazsınız.
