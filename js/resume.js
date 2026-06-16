/* Resume viewer
 * Wires the download button to the local .docx, then renders that same
 * file in-page with docx-preview. The download is set up first and never
 * depends on the renderer, so it works even if the CDN/render fails.
 */
(function () {
    'use strict';

    // Both /resume/ and /my-resume/ keep their file under this stable name,
    // so dropping in a replacement .docx (same name) updates the page.
    var FILE = 'Dharmendra_Yadav_Resume.docx';

    var downloadEl = document.getElementById('resume-download');
    var statusEl = document.getElementById('resume-status');
    var docEl = document.getElementById('resume-doc');

    // 1) Download link — independent of rendering.
    if (downloadEl) {
        downloadEl.setAttribute('href', FILE);
        downloadEl.setAttribute('download', FILE);
    }

    function fail(message) {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.classList.add('resume-status--error');
        }
    }

    // 2) Render the document. `docx` is the global from docx-preview.
    if (typeof docx === 'undefined' || !docx.renderAsync) {
        fail('Preview is unavailable right now — use the Download button above to get the resume.');
        return;
    }

    // Cache-bust so a freshly-replaced file shows immediately.
    fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        })
        .then(function (blob) {
            return docx.renderAsync(blob, docEl, null, {
                inWrapper: true,
                breakPages: true,
                ignoreLastRenderedPageBreak: true
            });
        })
        .then(function () {
            if (statusEl) statusEl.remove();
            fitToWidth();
            window.addEventListener('resize', fitToWidth);
        })
        .catch(function (err) {
            console.error('Resume render failed:', err);
            fail('Could not display the resume here — use the Download button above to get it.');
        });

    // The .docx renders as a fixed-width "sheet" (Letter ≈ 816px). On screens
    // narrower than that, scale the whole sheet down so it fits without
    // clipping — preserving the document's exact layout.
    function fitToWidth() {
        var wrapper = docEl.querySelector('.docx-wrapper');
        var page = docEl.querySelector('.docx-wrapper > section.docx');
        if (!wrapper || !page) return;

        wrapper.style.transform = 'none';
        docEl.style.height = 'auto';
        docEl.style.overflow = '';

        var available = docEl.clientWidth;
        var pageWidth = page.offsetWidth;
        if (pageWidth > available) {
            var scale = available / pageWidth;
            wrapper.style.transformOrigin = 'top center';
            wrapper.style.transform = 'scale(' + scale + ')';
            // Collapse the empty space the un-scaled layout box leaves behind.
            docEl.style.height = (wrapper.offsetHeight * scale) + 'px';
            docEl.style.overflow = 'hidden';
        }
    }
})();
