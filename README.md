# Animely

Animely, terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI aracıdır.

## Özellikler

*   **Anında İzleme:** İndirmeyi beklemeden, doğrudan VLC Media Player üzerinden yayın akışı (streaming) yapın.
*   **Akıllı İndirme Yöneticisi:**
*   **Kaldığı Yerden Devam Etme:** İnternetiniz kesilse veya program kapansa bile indirmeler kaldığı yerden devam eder.
*   **Kalıcı Kuyruk:** İndirme kuyruğunuz kaydedilir, programı yeniden başlattığınızda işlemleriniz kaybolmaz.
*   **Detaylı İstatistikler:** İndirme sırasında anlık hız, kalan süre ve ilerleme durumunu görün.
*   **Esnek Seçim:** İster tek bir bölümü, ister bir aralığı (örn: 1-12), isterseniz de tüm sezonu tek seferde indirin.
*   **Otomatik Güncelleme:** Yeni bir sürüm çıktığında sizi uyarır ve otomatik olarak günceller.
*   **Gelişmiş Arama:** Anime ismini yazın, en iyi eşleşmeleri anında bulun.
*   **Android Desteği:** Termux üzerinden çalıştırarak telefonunuzda da kullanabilirsiniz.
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


## Ayarlar

Ana menüden "Ayarlar" seçeneğine giderek:
*   Eşzamanlı indirme sayısını değiştirebilirsiniz.
*   İndirme klasörünü özelleştirebilirsiniz.

## Gereksinimler

*   **Node.js:** Çalıştırma ortamı (v14+ önerilir).
*   **VLC Media Player:** "İzle" özelliği için gereklidir. Bilgisayarınızda yüklü değilse Animely otomatik olarak kurmayı dener veya sizi yönlendirir.
