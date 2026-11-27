/*!
 * Revisione al volo – strumento di revisione per le anteprime dei clienti.
 * Uso: <link rel="stylesheet" href="/_review/review.css">
 *      <script src="/_review/review.js" data-progetto="acquolina" data-pagina="home" data-titolo="Homepage" defer></script>
 * Il cliente tocca un testo o una foto: Approva oppure Da cambiare (con la correzione).
 * Le voci restano salvate nel browser e arrivano a Netlify Forms (form "revisioni"):
 * un invio con tutte le voci, ripetuto quando cambiano. Vale l'ultimo invio per persona e pagina.
 */
(function () {
	'use strict';
	var me = document.currentScript || document.querySelector('script[src*="review.js"]');
	var CFG = {
		progetto: (me && me.dataset.progetto) || location.pathname.split('/')[1] || 'progetto',
		pagina: (me && me.dataset.pagina) || location.pathname.split('/')[2] || 'pagina',
		titolo: (me && me.dataset.titolo) || document.title
	};
	var KEY = 'rv:' + CFG.progetto + ':' + CFG.pagina;
	var NAME_KEY = 'rv:autore';
	var INTRO_KEY = 'rv:intro:' + CFG.progetto;
	var TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,figcaption,blockquote,td,th,dt,dd,label,.wp-block-button__link,.wp-element-button,button:not(.menu-toggle)';

	var store = load();
	var on = true;
	var current = null;

	function load() {
		try { return JSON.parse(localStorage.getItem(KEY)) || { voci: {}, inviato: 0, modificato: 0 }; }
		catch (e) { return { voci: {}, inviato: 0, modificato: 0 }; }
	}
	function save() {
		store.modificato = Date.now();
		try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
		paint();
	}
	function autore() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }

	function el(tag, cls, html) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (html != null) e.innerHTML = html;
		return e;
	}
	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
	function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
	function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
	function inUI(n) { return n && n.closest && n.closest('.rv-ui'); }

	/* Percorso CSS stabile: tag:nth-of-type dal body (salta i contenitori dello strumento). */
	function path(n) {
		var parts = [];
		while (n && n.nodeType === 1 && n !== document.body) {
			var i = 1, s = n;
			while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
			parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + ':nth-of-type(' + i + ')');
			if (n.id) break;
			n = n.parentElement;
		}
		return parts.join(' > ');
	}
	function bgImage(n) {
		var st = n.getAttribute && n.getAttribute('style') || '';
		var m = st.match(/url\(['"]?([^'")]+)/);
		if (m) return m[1];
		var b = getComputedStyle(n).backgroundImage;
		m = b && b.match(/url\(["']?([^"')]+)/);
		return m ? m[1] : '';
	}
	/* Dal punto toccato all'elemento da rivedere: foto (img o sfondo) oppure blocco di testo. */
	function pick(t) {
		if (!t || inUI(t)) return null;
		var img = t.closest('img, picture');
		if (img) { img = img.tagName === 'PICTURE' ? img.querySelector('img') || img : img; return { node: img, tipo: 'foto', src: img.currentSrc || img.src }; }
		for (var n = t; n && n !== document.body; n = n.parentElement) {
			if (n.matches && n.matches(TEXT_SEL) && clean(n.textContent)) return { node: n, tipo: 'testo' };
			var bg = n.nodeType === 1 && bgImage(n);
			if (bg && !/gradient/.test(bg) && n.offsetWidth * n.offsetHeight < innerWidth * innerHeight * 0.9) return { node: n, tipo: 'foto', src: bg };
		}
		return null;
	}
	function describe(p) {
		var n = p.node;
		var orig = p.tipo === 'testo' ? clean(n.innerText || n.textContent) : (n.getAttribute('alt') || '');
		var sez = n.closest('section, .wp-block-group, .wp-block-cover, header, footer');
		var titolo = sez && sez.querySelector('h1,h2,h3');
		return {
			id: hash(path(n) + '|' + (p.src || orig).slice(0, 120)),
			tipo: p.tipo,
			selettore: path(n),
			originale: orig.slice(0, 1200),
			foto: p.src ? p.src.split('?')[0] : '',
			sezione: titolo ? clean(titolo.textContent).slice(0, 80) : ''
		};
	}

	/* ─── Interfaccia ─────────────────────────────────────────────────── */
	var ui = el('div', 'rv-ui');
	var layer = el('div', 'rv-ui rv-layer');
	var hover = el('div', 'rv-ui rv-hover');
	var bar = el('div', 'rv-ui rv-bar');
	var sheet = el('div', 'rv-ui rv-sheet');
	var toast = el('div', 'rv-ui rv-toast');
	document.body.appendChild(layer);
	document.body.appendChild(hover);
	document.body.appendChild(ui);
	ui.appendChild(bar);
	ui.appendChild(sheet);
	ui.appendChild(toast);
	document.body.classList.add('rv-on');

	function say(msg) {
		toast.textContent = msg;
		toast.classList.add('is-show');
		clearTimeout(say.t);
		say.t = setTimeout(function () { toast.classList.remove('is-show'); }, 2600);
	}

	function counts() {
		var a = 0, c = 0;
		Object.keys(store.voci).forEach(function (k) { if (store.voci[k].stato === 'approvato') a++; else c++; });
		return { a: a, c: c };
	}
	function renderBar() {
		var n = counts();
		var pending = store.modificato > store.inviato && (n.a + n.c) > 0;
		bar.innerHTML =
			'<button class="rv-bar__mode" data-rv="mode" aria-pressed="' + on + '">' + (on ? '✎ Revisione attiva' : '👁 Solo guardare') + '</button>' +
			'<span class="rv-bar__n"><b class="ok">✓ ' + n.a + '</b><b class="ko">✎ ' + n.c + '</b></span>' +
			'<button class="rv-bar__help" data-rv="help" aria-label="Come funziona">?</button>' +
			'<button class="rv-bar__send' + (pending ? ' is-pending' : '') + '" data-rv="send">' + (pending ? 'Invia revisioni' : (store.inviato ? 'Inviate ✓' : 'Invia')) + '</button>';
	}

	function paint() {
		renderBar();
		layer.innerHTML = '';
		Object.keys(store.voci).forEach(function (k) {
			var v = store.voci[k], n = null;
			try { n = document.querySelector(v.selettore); } catch (e) {}
			if (!n) return;
			var r = n.getBoundingClientRect();
			if (!r.width && !r.height) return;
			var b = el('button', 'rv-pin ' + (v.stato === 'approvato' ? 'is-ok' : 'is-ko'), v.stato === 'approvato' ? '✓' : '✎');
			b.dataset.id = k;
			b.title = v.stato === 'approvato' ? 'Approvato' : 'Da cambiare: ' + (v.correzione || '');
			b.style.top = (r.top + scrollY - 10) + 'px';
			b.style.left = Math.min(r.right + scrollX - 14, document.documentElement.clientWidth - 30) + 'px';
			layer.appendChild(b);
			var o = el('div', 'rv-mark ' + (v.stato === 'approvato' ? 'is-ok' : 'is-ko'));
			o.style.cssText = 'top:' + (r.top + scrollY) + 'px;left:' + (r.left + scrollX) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
			layer.appendChild(o);
		});
	}

	function openSheet(p) {
		var d = describe(p);
		var prev = store.voci[d.id];
		current = { p: p, d: d };
		p.node.classList.add('rv-target');
		var isText = d.tipo === 'testo';
		var preview = isText
			? '<blockquote class="rv-sheet__orig">' + esc(d.originale.slice(0, 300)) + (d.originale.length > 300 ? '…' : '') + '</blockquote>'
			: '<div class="rv-sheet__img" style="background-image:url(\'' + esc(d.foto) + '\')"></div>';
		var val = prev && prev.correzione != null ? prev.correzione : (isText ? d.originale : '');
		sheet.innerHTML =
			'<div class="rv-sheet__in" role="dialog" aria-label="Revisione">' +
			'<div class="rv-sheet__head"><span class="rv-chip">' + (isText ? 'Testo' : 'Foto') + '</span>' + (d.sezione ? '<span class="rv-sheet__sec">' + esc(d.sezione) + '</span>' : '') +
			'<button class="rv-x" data-rv="close" aria-label="Chiudi">×</button></div>' + preview +
			'<div class="rv-sheet__acts"><button class="rv-btn rv-btn--ok' + (prev && prev.stato === 'approvato' ? ' is-sel' : '') + '" data-rv="ok">✓ Va bene così</button>' +
			'<button class="rv-btn rv-btn--ko' + (prev && prev.stato !== 'approvato' ? ' is-sel' : '') + '" data-rv="ko">✎ Da cambiare</button></div>' +
			'<div class="rv-sheet__edit"' + (prev && prev.stato !== 'approvato' ? '' : ' hidden') + '>' +
			'<label>' + (isText ? 'Scrivi il testo corretto' : 'Cosa non va? Cosa mettereste al suo posto?') + '</label>' +
			'<textarea rows="' + (isText ? 4 : 3) + '" placeholder="' + (isText ? '' : 'es. Cambiatela, non mi piace / mettete la foto della sala') + '">' + esc(val) + '</textarea>' +
			'<button class="rv-btn rv-btn--save" data-rv="save">Salva</button></div>' +
			(prev ? '<button class="rv-link" data-rv="del">Togli questa revisione</button>' : '') +
			'</div>';
		sheet.classList.add('is-open');
		if (prev && prev.stato !== 'approvato') setTimeout(function () { var t = sheet.querySelector('textarea'); if (t) t.focus(); }, 250);
	}
	function closeSheet() {
		sheet.classList.remove('is-open');
		if (current) current.p.node.classList.remove('rv-target');
		current = null;
	}
	function record(stato, corr) {
		var d = current.d;
		store.voci[d.id] = {
			tipo: d.tipo, stato: stato, selettore: d.selettore, sezione: d.sezione,
			originale: d.originale, foto: d.foto, correzione: stato === 'approvato' ? '' : clean(corr),
			quando: new Date().toISOString()
		};
		save();
		closeSheet();
		say(stato === 'approvato' ? 'Approvato ✓' : 'Annotato: lo sistemiamo noi');
	}

	/* ─── Invio a Netlify Forms ───────────────────────────────────────── */
	function payload() {
		var voci = Object.keys(store.voci).map(function (k) { var v = store.voci[k]; return Object.assign({ id: k }, v); });
		var n = counts();
		var righe = voci.map(function (v) {
			if (v.stato === 'approvato') return '✓ [' + v.tipo + '] ' + (v.tipo === 'foto' ? v.foto.split('/').pop() : '«' + v.originale.slice(0, 80) + '»');
			return '✎ [' + v.tipo + '] ' + (v.tipo === 'foto' ? v.foto.split('/').pop() : '«' + v.originale.slice(0, 120) + '»') + '\n   → ' + v.correzione;
		});
		var p = new URLSearchParams();
		p.append('form-name', 'revisioni');
		p.append('progetto', CFG.progetto);
		p.append('pagina', CFG.pagina);
		p.append('titolo', CFG.titolo);
		p.append('autore', autore() || 'anonimo');
		p.append('url', location.href.split('#')[0]);
		p.append('approvati', String(n.a));
		p.append('da_cambiare', String(n.c));
		p.append('riepilogo', righe.join('\n'));
		p.append('voci', JSON.stringify(voci));
		return p;
	}
	function send(beacon) {
		if (!Object.keys(store.voci).length) { if (!beacon) say('Nessuna revisione da inviare'); return; }
		var body = payload();
		if (beacon && navigator.sendBeacon) {
			if (navigator.sendBeacon('/', body)) { store.inviato = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
			return;
		}
		fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
			.then(function (r) {
				if (!r.ok) throw new Error(r.status);
				store.inviato = Date.now();
				try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
				renderBar();
				say('Revisioni inviate, grazie!');
			})
			.catch(function () { say('Invio non riuscito: riprova tra poco'); });
	}
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden' && store.modificato > store.inviato) send(true);
	});

	/* ─── Guida iniziale (sfondo sfumato) ─────────────────────────────── */
	function intro() {
		var o = el('div', 'rv-ui rv-intro');
		o.innerHTML =
			'<div class="rv-intro__card" role="dialog" aria-label="Come funziona la revisione">' +
			'<p class="rv-intro__kick">Anteprima · ' + esc(CFG.titolo) + '</p>' +
			'<h2>Diteci cosa <em>cambiare</em></h2>' +
			'<ol class="rv-intro__steps">' +
			'<li><span class="rv-ico">🖼</span><div><b>Toccate una foto</b><span>e scegliete <i>Va bene così</i> oppure <i>Da cambiare</i>, es. “Cambiatela, non mi piace”.</span></div></li>' +
			'<li><span class="rv-ico">✍️</span><div><b>Toccate un testo</b><span>e riscrivetelo come lo volete: lo correggiamo noi.</span></div></li>' +
			'<li><span class="rv-ico">✓</span><div><b>Vedete cosa avete già rivisto</b><span>✓ verde = approvato · ✎ = da cambiare. Toccate il segno per modificarlo.</span></div></li>' +
			'<li><span class="rv-ico">➤</span><div><b>Premete “Invia revisioni”</b><span>in basso. Funziona da computer e da telefono; potete tornare quando volete.</span></div></li>' +
			'</ol>' +
			'<label class="rv-intro__name">Il vostro nome<input type="text" maxlength="40" placeholder="es. Maria" value="' + esc(autore()) + '"></label>' +
			'<button class="rv-btn rv-btn--start">Inizia la revisione</button>' +
			'</div>';
		document.body.appendChild(o);
		requestAnimationFrame(function () { o.classList.add('is-open'); });
		o.querySelector('.rv-btn--start').addEventListener('click', function () {
			var v = clean(o.querySelector('input').value);
			try { if (v) localStorage.setItem(NAME_KEY, v); localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
			o.classList.remove('is-open');
			setTimeout(function () { o.remove(); }, 350);
		});
	}

	/* ─── Eventi ──────────────────────────────────────────────────────── */
	document.addEventListener('click', function (e) {
		var t = e.target;
		var act = t.closest && t.closest('[data-rv]');
		if (act) {
			e.preventDefault();
			var a = act.dataset.rv;
			if (a === 'mode') { on = !on; document.body.classList.toggle('rv-on', on); hover.style.display = 'none'; renderBar(); }
			else if (a === 'help') intro();
			else if (a === 'send') send(false);
			else if (a === 'close') closeSheet();
			else if (a === 'ok') record('approvato', '');
			else if (a === 'ko') { sheet.querySelector('.rv-sheet__edit').hidden = false; sheet.querySelector('textarea').focus(); sheet.querySelectorAll('.rv-btn--ok,.rv-btn--ko').forEach(function (b) { b.classList.toggle('is-sel', b.classList.contains('rv-btn--ko')); }); }
			else if (a === 'save') { var v = clean(sheet.querySelector('textarea').value); if (!v) { say('Scrivete cosa cambiare'); return; } record('da-cambiare', v); }
			else if (a === 'del') { delete store.voci[current.d.id]; save(); closeSheet(); say('Revisione tolta'); }
			return;
		}
		var pin = t.closest && t.closest('.rv-pin');
		if (pin) {
			var v2 = store.voci[pin.dataset.id], n2 = null;
			try { n2 = document.querySelector(v2.selettore); } catch (err) {}
			if (n2) openSheet(n2.tagName === 'IMG' || v2.tipo === 'foto' ? { node: n2, tipo: 'foto', src: v2.foto } : { node: n2, tipo: 'testo' });
			e.preventDefault();
			return;
		}
		if (inUI(t)) return;
		if (!on) {
			if (t.closest('a[href]') && !t.closest('a[href^="#"]')) { e.preventDefault(); say('Anteprima: i collegamenti sono disattivati'); }
			return;
		}
		var p = pick(t);
		e.preventDefault();
		e.stopPropagation();
		if (p) openSheet(p);
	}, true);
	// In revisione i moduli non partono.
	document.addEventListener('submit', function (e) { if (!inUI(e.target)) { e.preventDefault(); say('Anteprima: il modulo non invia'); } }, true);

	document.addEventListener('mousemove', function (e) {
		if (!on || inUI(e.target) || sheet.classList.contains('is-open')) { hover.style.display = 'none'; return; }
		var p = pick(e.target);
		if (!p) { hover.style.display = 'none'; return; }
		var r = p.node.getBoundingClientRect();
		hover.style.cssText = 'display:block;top:' + (r.top + scrollY) + 'px;left:' + (r.left + scrollX) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
		hover.dataset.tipo = p.tipo === 'foto' ? 'Foto' : 'Testo';
	}, { passive: true });

	var raf = 0;
	function repaint() { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }
	addEventListener('resize', repaint);
	addEventListener('load', repaint);
	setInterval(repaint, 1500);

	renderBar();
	paint();
	var seen = false;
	try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
	if (!seen) intro();
})();
