/* Static blog engine — feed + article rendering with a tiny Markdown
   renderer. No build step, no dependencies. Posts live in posts/posts.json
   (manifest) and posts/<slug>.md (content). */
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // inline formatting on an already-escaped string
  function inlineMd(s) {
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    return s;
  }

  function mdToHtml(md) {
    var lines = md.replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, n = lines.length;
    var blockStart = /^(#{1,6}\s|>\s?|```|\s*[-*+]\s+|\s*\d+\.\s+|(-{3,}|\*{3,}|_{3,})\s*$)/;

    while (i < n) {
      var line = lines[i];

      if (/^```/.test(line)) {
        var code = []; i++;
        while (i < n && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }

      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        var lvl = Math.min(h[1].length + 1, 6);
        out.push('<h' + lvl + '>' + inlineMd(escapeHtml(h[2])) + '</h' + lvl + '>');
        i++; continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < n && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + inlineMd(escapeHtml(q.join(' '))) + '</blockquote>');
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        var ul = [];
        while (i < n && /^\s*[-*+]\s+/.test(lines[i])) {
          ul.push('<li>' + inlineMd(escapeHtml(lines[i].replace(/^\s*[-*+]\s+/, ''))) + '</li>'); i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>'); continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        var ol = [];
        while (i < n && /^\s*\d+\.\s+/.test(lines[i])) {
          ol.push('<li>' + inlineMd(escapeHtml(lines[i].replace(/^\s*\d+\.\s+/, ''))) + '</li>'); i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>'); continue;
      }
      var buf = [];
      while (i < n && !/^\s*$/.test(lines[i]) && !blockStart.test(lines[i])) { buf.push(lines[i]); i++; }
      if (buf.length) out.push('<p>' + inlineMd(escapeHtml(buf.join(' '))) + '</p>');
    }
    return out.join('\n');
  }

  function fmtDate(s) {
    var d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function metaLine(p) {
    var html = '<span>' + fmtDate(p.date) + '</span>';
    if (p.readingTime) html += '<span class="dot">·</span><span>' + escapeHtml(p.readingTime) + '</span>';
    return html;
  }

  function renderFeed() {
    var feed = document.getElementById('feed');
    var moreBtn = document.getElementById('loadMore');
    fetch('posts/posts.json').then(function (r) { return r.json(); }).then(function (data) {
      var posts = (data.posts || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
      var shown = 0, BATCH = 10;
      function render() {
        posts.slice(shown, shown + BATCH).forEach(function (p) {
          var a = document.createElement('a');
          a.className = 'post-card';
          a.href = 'post.html?slug=' + encodeURIComponent(p.slug);
          var tags = (p.tags || []).map(function (t) { return '<span class="chip">' + escapeHtml(t) + '</span>'; }).join('');
          a.innerHTML =
            '<h2 class="post-card__title">' + escapeHtml(p.title) + '</h2>' +
            '<p class="post-card__excerpt">' + escapeHtml(p.excerpt || '') + '</p>' +
            '<div class="post-card__meta">' + metaLine(p) + '</div>' +
            (tags ? '<div class="post-card__tags">' + tags + '</div>' : '');
          feed.appendChild(a);
        });
        shown += Math.min(BATCH, posts.length - shown);
        if (moreBtn) moreBtn.style.display = shown < posts.length ? '' : 'none';
      }
      render();
      if (moreBtn) moreBtn.addEventListener('click', render);
    }).catch(function () {
      feed.innerHTML = '<p class="blog-error">Couldn’t load posts.</p>';
      if (moreBtn) moreBtn.style.display = 'none';
    });
  }

  function renderPost() {
    var slug = new URLSearchParams(location.search).get('slug');
    var titleEl = document.getElementById('title');
    var metaEl = document.getElementById('meta');
    var bodyEl = document.getElementById('body');
    if (!slug) { titleEl.textContent = 'Post not found'; return; }

    fetch('posts/posts.json').then(function (r) { return r.json(); }).then(function (data) {
      var meta = (data.posts || []).find(function (p) { return p.slug === slug; });
      if (meta) {
        titleEl.textContent = meta.title;
        document.title = meta.title + ' — Dharmendra Yadav';
        var tags = (meta.tags || []).map(function (t) { return '<span class="chip">' + escapeHtml(t) + '</span>'; }).join('');
        metaEl.innerHTML = metaLine(meta) + (tags ? '<span class="dot">·</span>' + tags : '');
      }
      return fetch('posts/' + slug + '.md');
    }).then(function (r) {
      if (!r || !r.ok) throw new Error('not found');
      return r.text();
    }).then(function (md) {
      bodyEl.innerHTML = mdToHtml(md);
    }).catch(function () {
      if (titleEl && !titleEl.textContent) titleEl.textContent = 'Post not found';
      bodyEl.innerHTML = '<p class="blog-error">Couldn’t load this post.</p>';
    });
  }

  ready(function () {
    if (document.getElementById('feed')) renderFeed();
    else if (document.getElementById('body')) renderPost();
  });
})();
