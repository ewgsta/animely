# Animely

Animely, terminaliniz üzerinden anime izlemenizi ve indirmenizi sağlayan güçlü, şık ve basit bir CLI (Komut Satırı Arayüzü) aracıdır.

## Özellikler

*   **Anında İzleme:** İndirmeyi beklemeden, doğrudan VLC Media Player üzerinden yayın akışı (streaming) yapın.
*   **Toplu İndirme:** İster tek bir bölümü, ister bir aralığı (örn: 1-12), isterseniz de tüm sezonu tek seferde indirin.
*   **Gelişmiş Arama:** Anime ismini yazın, en iyi eşleşmeleri anında bulun.
*   **Android Desteği:** Termux üzerinden çalıştırarak telefonunuzda da kullanabilirsiniz.
*   **Kullanıcı Dostu Arayüz:** Renkli, anlaşılır ve etkileşimli menüler.

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

### Android (Termux) Kullanımı

Android cihazınızda Termux uygulamasını kullanıyorsanız, video oynatıcıyı (VLC, MX Player vb.) tetiklemek için `--android` parametresini kullanın:

```bash
animely --android
```

## Gereksinimler

*   **Node.js:** Çalıştırma ortamı.
*   **VLC Media Player:** "İzle" özelliği için gereklidir (Bilgisayar sürümü için). Android sürümünde yüklü herhangi bir video oynatıcı yeterlidir.

## Geliştirici

Bu proje [ewgsta](https://github.com/ewgsta) tarafından geliştirilmiştir.

## Lisans

ISC
