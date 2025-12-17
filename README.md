# Animely

Animely, terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI aracıdır.

## Özellikler

*   **Anında İzleme:** İndirmeyi beklemeden, doğrudan **VLC Media Player** veya **MPV Player** üzerinden yayın akışı (streaming) yapın.
*   **Discord Rich Presence (RPC):** Anime izlerken veya menüde gezerken Discord profilinizde ne yaptığınız otomatik olarak gözükür.
*   **Akıllı İndirme Yöneticisi:**
    *   **Kaldığı Yerden Devam Etme:** İnternetiniz kesilse veya program kapansa bile indirmeler kaldığı yerden devam eder.
    *   **Kalıcı Kuyruk:** İndirme kuyruğunuz kaydedilir, programı yeniden başlattığınızda işlemleriniz kaybolmaz.
    *   **Detaylı İstatistikler:** İndirme sırasında anlık hız, indirilen boyut, toplam boyut ve kalan süre (ETA) bilgilerini görün.
*   **Esnek Seçim:** İster tek bir bölümü, ister bir aralığı (örn: 1-12), isterseniz de tüm sezonu tek seferde indirin.
*   **Otomatik Güncelleme:** Yeni bir sürüm çıktığında sizi uyarır ve otomatik olarak günceller.
*   **Gelişmiş Arama:** Anime ismini yazın, en iyi eşleşmeleri anında bulun.
*   **Kullanıcı Dostu Arayüz:** Renkli, anlaşılır, Türkçe ve etkileşimli menüler.

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
*   Varsayılan video oynatıcısını değiştirebilirsiniz.
*   Eşzamanlı indirme sayısını değiştirebilirsiniz.
*   İndirme klasörünü özelleştirebilirsiniz.

> **Not:** Ayarlar ve indirme kuyruğu dosyanız, kullanıcı ana dizininizde (`~/.animely/`) güvenli bir şekilde saklanır.

## Gereksinimler

*   **Node.js:** Çalıştırma ortamı (v14+ önerilir).
*   **Video Oynatıcı:** "İzle" özelliği için **VLC Media Player** veya **MPV Player** gereklidir. Animely, sisteminizde yüklü olanı otomatik algılar veya kurulum için yardımcı olur.

## Lisans

Bu proje [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) lisansı ile lisanslanmıştır.

Bu lisans altında:
*   **Paylaş:** Eseri her ortam veya formatta kopyalayabilir ve yeniden dağıtabilirsiniz.
*   **Atıf:** Uygun referans vermeli, lisansa bağlantı sağlamalı ve değişiklik yapıldıysa bilgi vermelisiniz.
*   **Ticari Olmayan:** Bu materyali ticari amaçlarla kullanamazsınız.
*   **Türetilemez:** Eğer materyali karıştırır, aktarır veya üzerine inşa ederseniz, değiştirilmiş materyali dağıtamazsınız.
