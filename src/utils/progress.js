import bytes from "bytes";

export class ProgressBar {
    constructor() {
        this.items = new Map();
        this.lastLineCount = 0;
    }

    /**
     * İndirme öğesi ekle veya güncelle
     * @param {string|number} id Benzersiz kimlik
     * @param {object} data Veri
     * @param {string} [data.name] Görünen isim
     * @param {number} [data.percent] Yüzde (0-100)
     * @param {string} [data.status] Durum (bekliyor, indiriliyor, tamamlandi, hata)
     * @param {number} [data.speed] Hız (byte/s)
     * @param {number} [data.eta] Kalan süre (saniye)
     * @param {number} [data.downloaded] İndirilen miktar (byte)
     * @param {number} [data.total] Toplam boyut (byte)
     */
    update(id, data) {
        const existing = this.items.get(id) || {
            name: '',
            percent: 0,
            status: 'bekliyor',
            speed: 0,
            eta: 0,
            downloaded: 0,
            total: 0
        };
        this.items.set(id, { ...existing, ...data });
        this.render();
    }

    render() {
        const activeItems = Array.from(this.items.values())
            .filter(data => data.status === 'indiriliyor');

        if (activeItems.length === 0 && this.lastLineCount === 0) return;

        const output = activeItems.map(data => {
            const width = 20;
            const percent = typeof data.percent === 'number' && !isNaN(data.percent) ? data.percent : 0;
            const filled = Math.floor((percent / 100) * width);
            const progressBar = "█".repeat(filled) + "░".repeat(width - filled);

            const name = data.name.length > 25 ? data.name.substring(0, 22) + "..." : data.name.padEnd(25);

            const eta = data.eta || 0;
            const h = Math.floor(eta / 3600);
            const m = Math.floor((eta % 3600) / 60);
            const s = eta % 60;
            const etaStr = h > 0 ? `${h}s ${m}dk ${s}sn` : m > 0 ? `${m}dk ${s}sn` : `${s}sn`;

            const speedStr = data.speed ? bytes(data.speed) + '/s' : '0B/s';
            const downloadedStr = data.downloaded ? bytes(data.downloaded) : '0B';
            const totalStr = data.total ? bytes(data.total) : '0B';

            return `${name}: [${progressBar}] %${percent.toFixed(1)} (${downloadedStr} / ${totalStr}) - ${speedStr} - kalan: ${etaStr}`;
        }).join("\n");

        if (this.lastLineCount > 0) {
            process.stdout.moveCursor(0, -this.lastLineCount);
            process.stdout.cursorTo(0);
            process.stdout.clearScreenDown();
        }

        if (activeItems.length > 0) {
            console.log(output);
            this.lastLineCount = output.split('\n').length;
        } else {
            this.lastLineCount = 0;
        }
    }

    clear() {
        if (this.lastLineCount > 0) {
            process.stdout.moveCursor(0, -this.lastLineCount);
            process.stdout.cursorTo(0);
            process.stdout.clearScreenDown();
            this.lastLineCount = 0;
        }
        this.items.clear();
    }
}
