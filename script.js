(function () {
  'use strict';
  const BASE = window.BASE_ST, PAGINA = 40;
  const $ = (id) => document.getElementById(id);
  const el = { q: $('q'), seg: $('seg'), sit: $('sit'), linha: $('linha'), lista: $('lista'),
               resumo: $('resumo'), aviso: $('aviso'), mais: $('mais') };
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const dig = (s) => String(s).replace(/\D/g, '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = (iso) => iso.split('-').reverse().join('/');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

  // Pré-processamento (índice de busca)
  const dados = BASE.registros.map((r) => Object.assign(r, {
    _t: norm([r.d, r.s, r.c, r.p, r.r, r.rv].join(' ')),
    _n: r.n.map(dig).filter(Boolean),
    _c: dig(r.c),
    vigente: r.v <= hojeISO
  }));
  const estado = { vig: '', mostrar: PAGINA, filtrados: [], tokens: [] };

  // Filtros iniciais
  [...new Set(dados.map((r) => r.s))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach((s) => el.seg.add(new Option(s, s)));
  function desenhaLinha() {
    const datas = [...new Set(dados.map((r) => r.v))].sort();
    const chip = (v, txt, cls) => `<button class="chip ${cls || ''} ${estado.vig === v ? 'on' : ''}" data-v="${v}">${txt}</button>`;
    el.linha.innerHTML = chip('', 'Todas as datas') + datas.map((v) => {
      const n = dados.filter((r) => r.v === v).length;
      return chip(v, `${br(v)} · <b>${n}</b>`, v <= hojeISO ? 'vig' : 'fut');
    }).join('');
  }
  el.linha.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    estado.vig = b.dataset.v; desenhaLinha(); buscar();
  });

  // Busca: todos os termos (E). Termos numéricos casam por prefixo em NCM/CEST.
  function casaNumero(r, d) {
    if (r._c.startsWith(d)) return d.length;
    let melhor = 0;
    for (const n of r._n) {
      if (n.startsWith(d)) melhor = Math.max(melhor, d.length);          // digitou o início do NCM
      else if (d.length >= 4 && d.startsWith(n)) melhor = Math.max(melhor, n.length); // NCM completo dentro de posição/subposição da lista
    }
    return melhor;
  }
  function buscar() {
    estado.mostrar = PAGINA;
    const termos = el.q.value.trim().split(/\s+/).filter(Boolean).map((t) => {
      const soNum = /^[\d.\-]+$/.test(t) && dig(t).length >= 2;
      return soNum ? { num: dig(t) } : { txt: norm(t) };
    });
    estado.tokens = termos.filter((t) => t.txt).map((t) => t.txt);
    const res = [];
    for (const r of dados) {
      if (el.seg.value && r.s !== el.seg.value) continue;
      if (estado.vig && r.v !== estado.vig) continue;
      if (el.sit.value === 'vig' && !r.vigente) continue;
      if (el.sit.value === 'fut' && r.vigente) continue;
      let score = 0, ok = true;
      for (const t of termos) {
        if (t.num) { const m = casaNumero(r, t.num); if (!m && !r._t.includes(t.num)) { ok = false; break; } score += m; }
        else if (!r._t.includes(t.txt)) { ok = false; break; }
      }
      if (ok) res.push([score, r]);
    }
    res.sort((a, b) => b[0] - a[0] || a[1].v.localeCompare(b[1].v) || a[1].c.localeCompare(b[1].c));
    estado.filtrados = res.map((x) => x[1]);
    estado.termosNum = termos.filter((t) => t.num).map((t) => t.num);
    desenha();
  }

  function marca(txt) {
    let h = esc(txt);
    estado.tokens.filter((t) => t.length > 1).forEach((t) => {
      // realça ignorando acentos: percorre o texto original
      const n = norm(txt); let out = '', i = 0, j;
      while ((j = n.indexOf(t, i)) > -1) { out += esc(txt.slice(i, j)) + '<mark>' + esc(txt.slice(j, j + t.length)) + '</mark>'; i = j + t.length; }
      if (i) h = out + esc(txt.slice(i));
    });
    return h;
  }
  function selo(r) {
    if (r.vigente) return '<span class="badge vig">Excluído da ST</span>';
    const dias = Math.ceil((new Date(r.v + 'T00:00:00') - hoje) / 864e5);
    return `<span class="badge fut">A vigorar · ${dias} dia${dias === 1 ? '' : 's'}</span>`;
  }
  function desenha() {
    const f = estado.filtrados, vis = f.slice(0, estado.mostrar);
    el.lista.innerHTML = vis.length ? vis.map((r, i) => `
      <div class="item" data-i="${i}">
        <button class="row" type="button" aria-expanded="false">
          <span><span class="data">${br(r.v)}</span><br>${selo(r)}</span>
          <span class="mono">${esc(r.c)}</span>
          <span class="ncms mono">${r.n.map((n) => `<span>${esc(n)}</span>`).join('')}</span>
          <span class="desc">${marca(r.d)}<span class="seg">${esc(r.s)}</span></span>
        </button>
        <div class="det"><dl>
          <dt>Fundamento (Portaria CAT 68/2019)</dt><dd>${esc(r.p) || '—'}</dd>
          <dt>Base legal (RICMS/SP)</dt><dd>${esc(r.r) || '—'}</dd>
          <dt>Ato da exclusão</dt><dd>${esc(r.rv) || '—'}</dd>
          <dt>Segmento</dt><dd>${esc(r.s)}</dd>
        </dl><button class="btn" type="button" data-copia="${i}">Copiar NCM + CEST</button></div>
      </div>`).join('') : '<div class="vazio">Nenhum item encontrado com esses filtros.</div>';
    el.mais.hidden = f.length <= vis.length;
    el.mais.textContent = `Mostrar mais (${f.length - vis.length} restantes)`;
    el.resumo.textContent = `${f.length} de ${dados.length} registros`;
    avisoNcm();
  }
  function avisoNcm() {
    const d = (estado.termosNum || []).find((x) => x.length >= 4);
    el.aviso.hidden = !d; el.aviso.className = 'aviso';
    if (!d) return;
    const f = estado.filtrados, n = f.length;
    if (!n) { el.aviso.classList.add('warn'); el.aviso.innerHTML = `<b>${esc(d)}</b> não consta na lista de exclusão desta planilha (com os filtros atuais). Confira o NCM, o CEST e se o filtro de segmento/data não está restringindo o resultado.`; return; }
    const vig = f.filter((r) => r.vigente).length;
    el.aviso.innerHTML = `<b>${n}</b> item(ns) da lista casam com <b>${esc(d)}</b> — ${vig} já excluído(s) da ST, ${n - vig} a vigorar. Confirme o <b>CEST</b> e as exceções da descrição antes de concluir.`;
  }

  el.lista.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copia]');
    if (cp) {
      const r = estado.filtrados[cp.dataset.copia];
      navigator.clipboard && navigator.clipboard.writeText(`NCM ${r.n.join(' / ')} | CEST ${r.c}`);
      cp.textContent = 'Copiado!'; setTimeout(() => (cp.textContent = 'Copiar NCM + CEST'), 1200); return;
    }
    const row = e.target.closest('.row'); if (!row) return;
    const it = row.parentElement; it.classList.toggle('open');
    row.setAttribute('aria-expanded', it.classList.contains('open'));
  });
  el.mais.addEventListener('click', () => { estado.mostrar += PAGINA; desenha(); });
  let t; el.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 120); });
  el.seg.addEventListener('change', buscar); el.sit.addEventListener('change', buscar);
  $('limpar').addEventListener('click', () => { el.q.value = ''; el.seg.value = ''; el.sit.value = ''; estado.vig = ''; desenhaLinha(); buscar(); el.q.focus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== el.q) { e.preventDefault(); el.q.focus(); el.q.select(); }
  });

  $('csv').addEventListener('click', () => {
    const cab = ['Vigência', 'Situação', 'CEST', 'NCM/SH', 'Descrição', 'Segmento', 'Portaria CAT 68/2019', 'RICMS/SP', 'Ato da exclusão'];
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const linhas = estado.filtrados.map((r) => [br(r.v), r.vigente ? 'Excluído da ST' : 'A vigorar', r.c, r.n.join(' / '), r.d, r.s, r.p, r.r, r.rv].map(q).join(';'));
    const blob = new Blob(['\ufeff' + [cab.map(q).join(';')].concat(linhas).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'exclusao-st-sp.csv'; a.click(); URL.revokeObjectURL(a.href);
  });

  $('fonte').textContent = `Fonte: ${BASE.fonte} · ${dados.length} registros únicos · base gerada em ${br(BASE.gerado)}.`;
  desenhaLinha(); buscar();
})();
