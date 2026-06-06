// Smooth scroll enhancement
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            const element = document.querySelector(href);
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Update nav link active state based on scroll position
const updateActiveNav = () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
};

window.addEventListener('scroll', updateActiveNav);

// Intersection Observer for fade-in animations
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}

// Latest writing teaser — pulls the 3 newest posts from the blog manifest
(function () {
    var list = document.getElementById('writing-list');
    if (!list) return;
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(s) { return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    fetch('blog/posts/posts.json').then(function (r) { return r.json(); }).then(function (data) {
        var posts = (data.posts || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 3);
        posts.forEach(function (p) {
            var a = document.createElement('a');
            a.className = 'writing-card';
            a.href = 'blog/post.html?slug=' + encodeURIComponent(p.slug);
            a.innerHTML =
                '<h3 class="writing-card__title">' + esc(p.title) + '</h3>' +
                '<p class="writing-card__excerpt">' + esc(p.excerpt || '') + '</p>' +
                '<div class="writing-card__meta"><span>' + fmt(p.date) + '</span>' +
                (p.readingTime ? '<span class="dot">·</span><span>' + esc(p.readingTime) + '</span>' : '') + '</div>';
            list.appendChild(a);
        });
    }).catch(function () {
        var s = document.getElementById('writing');
        if (s) s.style.display = 'none';
    });
})();

// Mobile nav hamburger toggle
(function () {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.nav-toggle');
    if (!header || !toggle) return;
    function setOpen(open) {
        header.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(!header.classList.contains('is-open'));
    });
    // close when a link is tapped, when clicking outside, or on Escape
    document.querySelectorAll('.nav-links .nav-link').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('click', function (e) {
        if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });
})();
