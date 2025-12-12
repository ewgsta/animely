const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
let shootingStars = [];

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initStars();
}

class Star {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.5;
        this.blinkSpeed = 0.02 + Math.random() * 0.05;
        this.alpha = Math.random();
        this.blinkDir = 1;
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.alpha += this.blinkSpeed * this.blinkDir;
        if (this.alpha >= 1 || this.alpha <= 0.2) {
            this.blinkDir *= -1;
        }
    }
}

class ShootingStar {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = 0;
        this.len = Math.random() * 80 + 10;
        this.speed = Math.random() * 10 + 6;
        this.size = Math.random() * 1 + 0.1;
        // Angle between 45 and 80 degrees
        this.angle = (Math.random() * 35 + 45) * (Math.PI / 180); 
        this.waitTime = new Date().getTime() + Math.random() * 3000 + 1000;
        this.active = false;
    }

    draw() {
        if (!this.active) return;
        
        const endX = this.x - this.len * Math.cos(this.angle);
        const endY = this.y - this.len * Math.sin(this.angle);

        const gradient = ctx.createLinearGradient(this.x, this.y, endX, endY);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    update() {
        if (this.active) {
            this.x -= this.speed * Math.cos(this.angle);
            this.y += this.speed * Math.sin(this.angle);
            if (this.x < 0 || this.y > height) {
                this.active = false;
                this.reset();
            }
        } else {
            if (new Date().getTime() > this.waitTime) {
                this.active = true;
            }
        }
    }
}

function initStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push(new Star());
    }
    shootingStars = [];
    for (let i = 0; i < 2; i++) {
        shootingStars.push(new ShootingStar());
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    
    stars.forEach(star => {
        star.update();
        star.draw();
    });

    shootingStars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
animate();

function copyCommand() {
    const command = "npm install -g animely";
    navigator.clipboard.writeText(command).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
    });
}
