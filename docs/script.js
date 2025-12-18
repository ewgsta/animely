// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;
const icon = themeToggle.querySelector('i');

// Check local storage
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
updateIcon(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcon(newTheme);
});

function updateIcon(theme) {
    if (theme === 'dark') {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

// Copy Command
function copyCommand() {
    const command = document.getElementById('install-command').innerText;
    navigator.clipboard.writeText(command).then(() => {
        const feedback = document.querySelector('.copy-feedback');
        feedback.classList.add('show');
        setTimeout(() => feedback.classList.remove('show'), 2000);
    });
}

// Typewriter Effect
const typewriterElement = document.getElementById('typewriter');
const lines = [
    { text: '> animely', class: 'command' },
    { text: 'Animely CLI...', class: 'info' },
    { text: '? ne yapmak istersin?', class: 'question' },
    { text: '> anime ara', class: 'selection' },
    { text: '? anime isimi gir', class: 'question' },
    { text: '> Death Note', class: 'input' },
    { text: '1 sonuç bulundu', class: 'success' },
    { text: '  Death Note (37 Bölüm)', class: 'result' },
    { text: '_', class: 'cursor' }
];

let lineIndex = 0;
let charIndex = 0;
let isTyping = true;

function typeWriter() {
    if (lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        if (charIndex === 0) {
            const div = document.createElement('div');
            div.className = `line ${line.class}`;
            typewriterElement.appendChild(div);
        }

        const currentDiv = typewriterElement.lastElementChild;
        
        if (line.text === '_') {
            currentDiv.innerHTML = '<span class="blink">_</span>';
            return; // Stop typing
        }

        if (charIndex < line.text.length) {
            currentDiv.textContent += line.text.charAt(charIndex);
            charIndex++;
            setTimeout(typeWriter, 30 + Math.random() * 50);
        } else {
            lineIndex++;
            charIndex = 0;
            setTimeout(typeWriter, 500);
        }
    }
}

// Start typewriter when element is in view
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && isTyping) {
            typeWriter();
            isTyping = false; // Run only once
        }
    });
});

observer.observe(typewriterElement);

// Scroll Reveal
const scrollElements = document.querySelectorAll('.scroll-reveal');

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.1 });

scrollElements.forEach(el => scrollObserver.observe(el));

