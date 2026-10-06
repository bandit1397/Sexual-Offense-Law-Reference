/* 화면 처리. 입력값은 메모리에만 두고 저장·전송하지 않는다. */
(function () {
  'use strict';
  var D = window.LawData, E = window.Engine, C = window.Checklist, L = D.LAWS;
  var $ = function (s) { return document.querySelector(s); };

  var ACTS = [
    { v: 'r', t: '간음(성교)', ex: '성기 삽입' },
    { v: 'p', t: '유사강간(삽입행위)', ex: '구강·항문에 성기, 성기·항문에 손가락·도구' },
    { v: 't', t: '추행(신체 접촉)', ex: '만지기, 강제 입맞춤 등' },
    { v: 'buying', t: '대가 성행위', ex: '성매수·성매매·조건만남' },
    { v: 'media', t: '촬영물·영상', ex: '불법촬영·유포·소지·딥페이크·협박' },
    { v: 'online', t: '온라인·통신', ex: '음란 메시지·그루밍' },
    { v: 'exposure', t: '노출·음란행위', ex: '공공장소 노출·자위' },
    { v: 'intrusion', t: '화장실·탈의실 침입', ex: '성적 목적' },
    { v: 'abuse', t: '성희롱·성적 학대', ex: '아동·장애인·노인 대상' },
    { v: 'kidnap', t: '약취·유인', ex: '성적 목적으로 데려감' }
  ];
  var CONTACT = ['r', 'p', 't'];
  var MEANS = [
    { v: 'force', t: '폭행·협박', ex: '때림, 누름, 흉기·말로 위협 등 저항을 억누름' },
    { v: 'surprise', t: '기습', ex: '예상 못 한 순간 갑자기 만짐 (지하철·길거리 등)' },
    { v: 'incap', t: '항거불능 상태 이용', ex: '만취·약물·잠·기절 상태를 이용' },
    { v: 'deceit', t: '위계·위력', ex: '속임수, 지위·권세·영향력 이용 (폭행·협박에 이르지 않음)' },
    { v: 'distress', t: '궁박 상태 이용', ex: '가출·경제적 곤궁 등 어려운 처지를 이용 (13~15세)' },
    { v: 'none', t: '강제 수단 없음', ex: '겉으로는 동의한 것처럼 보임' }
  ];
  var DISAB = [
    { v: 'none', t: '장애 없음' },
    { v: 'disabled', t: '신체적·정신적 장애 있음', ex: '장애인 등록 여부와 무관, 실제 장애로 판단' },
    { v: 'weak', t: '장애로 판단능력이 미약함', ex: '지적장애 등으로 사물 변별·의사결정 능력 미약' }
  ];
  var FLAGS = [
    { v: 'weapon', t: '흉기·위험한 물건 휴대', acts: CONTACT },
    { v: 'group', t: '2명 이상 합동', acts: CONTACT },
    { v: 'kin', t: '친족 (4촌 이내·동거·사실상)', acts: CONTACT.concat(['abuse']) },
    { v: 'homeInvasion', t: '주거침입 후 범행', acts: CONTACT },
    { v: 'burglary', t: '야간주거침입절도·특수절도', acts: CONTACT },
    { v: 'robbery', t: '강도', acts: CONTACT },
    { v: 'specialRobbery', t: '특수강도 (흉기·합동 강도)', acts: CONTACT },
    { v: 'crowded', t: '대중교통·공중 밀집 장소', acts: CONTACT.concat(['exposure']) },
    { v: 'workplace', t: '업무·고용 등 보호·감독 관계', acts: CONTACT },
    { v: 'custody', t: '구금된 사람 ↔ 감호자', acts: CONTACT },
    { v: 'facility', t: '장애인시설 장·종사자', acts: CONTACT },
    { v: 'reporter', t: '학교·학원·어린이집·병원 등 신고의무기관 종사자', acts: CONTACT },
    { v: 'intrusionPlace', t: '화장실·탈의실에 들어가서 촬영', acts: ['media'] },
    { v: 'habitual', t: '상습', acts: CONTACT.concat(['media']) },
    { v: 'offMilitary', t: '가해자가 군인 등', acts: null }
  ];
  var RESULTS = [
    { v: 'none', t: '상해·사망 없음' }, { v: 'hurt', t: '다침 (치상)' }, { v: 'injury', t: '고의로 상해' },
    { v: 'death', t: '사망 (치사)' }, { v: 'murder', t: '살해' }
  ];
  var STAGES = [{ v: 'done', t: '완료(기수)' }, { v: 'attempt', t: '시도했으나 미완성(미수)' }, { v: 'prep', t: '준비·공모(예비·음모)' }];
  var SUBS = {
    media: { key: 'sub', title: '무엇을 했나', opts: [
      { v: 'film', t: '촬영 / 합성·편집' }, { v: 'dist', t: '유포·제공·판매' }, { v: 'possess', t: '소지·구입·저장·시청' },
      { v: 'threat', t: '영상으로 협박' }, { v: 'coerce', t: '협박해서 무언가를 시킴' }] },
    online: { key: 'sub', title: '어떤 내용인가', opts: [
      { v: 'lewd', t: '음란한 말·사진·영상 전송' }, { v: 'groom', t: '아동·청소년과 성적 대화·유인 (그루밍)' }] },
    buying: { key: 'sub', title: '어디까지 했나', opts: [
      { v: 'done', t: '성적 행위를 함' }, { v: 'lure', t: '유인·권유만 함' }] }
  };
  var BUYKIND = [{ v: 'r', t: '성교' }, { v: 'p', t: '유사성교' }, { v: 't', t: '신체 접촉·노출 등' }];

  var state;
  function initState() {
    state = {
      date: E.today(), victim: { age: null, birth: null, disability: 'none', military: false },
      offender: { age: null, birth: null, military: false },
      act: 'r', means: 'force', sub: null, buyKind: 'r', synthetic: false, profit: false,
      f: {}, result: 'none', stage: 'done'
    };
  }

  /* ── 칩 렌더링 ── */
  function chips(el, opts, isOn, onPick) {
    el.innerHTML = '';
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', isOn(o.v) ? 'true' : 'false');
      b.innerHTML = esc(o.t) + (o.ex ? '<span class="ex">' + esc(o.ex) + '</span>' : '');
      b.addEventListener('click', function () { onPick(o.v); renderForm(); compute(); });
      el.appendChild(b);
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function renderForm() {
    chips($('#act'), ACTS, function (v) { return state.act === v; }, function (v) {
      if (state.act !== v) { state.act = v; state.sub = SUBS[v] ? SUBS[v].opts[0].v : null; }
    });
    var isContact = CONTACT.indexOf(state.act) >= 0;

    // 세부 선택
    var box = $('#subBox'); box.innerHTML = '';
    var sub = SUBS[state.act];
    if (sub) {
      if (!state.sub) state.sub = sub.opts[0].v;
      addSub(box, sub.title, sub.opts, function (v) { return state.sub === v; }, function (v) { state.sub = v; });
    }
    if (state.act === 'media') {
      addSub(box, '영상 종류·목적', [{ v: 'synthetic', t: '딥페이크·합성물' }, { v: 'profit', t: '돈 벌 목적 + 인터넷 유포' }],
        function (v) { return state[v]; }, function (v) { state[v] = !state[v]; });
    }
    if (state.act === 'buying' && state.sub !== 'lure') {
      addSub(box, '행위 내용', BUYKIND, function (v) { return state.buyKind === v; }, function (v) { state.buyKind = v; });
    }

    $('#meansStep').hidden = !isContact;
    if (isContact) chips($('#means'), MEANS, function (v) { return state.means === v; }, function (v) { state.means = v; });

    chips($('#disability'), DISAB, function (v) { return state.victim.disability === v; }, function (v) { state.victim.disability = v; });
    chips($('#vflags'), [{ v: 'military', t: '피해자가 군인 등' }], function () { return state.victim.military; }, function () { state.victim.military = !state.victim.military; });

    var fl = FLAGS.filter(function (x) { return !x.acts || x.acts.indexOf(state.act) >= 0; });
    chips($('#flags'), fl, function (v) { return v === 'offMilitary' ? state.offender.military : !!state.f[v]; }, function (v) {
      if (v === 'offMilitary') state.offender.military = !state.offender.military; else state.f[v] = !state.f[v];
    });
    // 숨겨진 행위의 플래그는 끄기
    FLAGS.forEach(function (x) { if (x.acts && x.acts.indexOf(state.act) < 0 && x.v !== 'offMilitary') delete state.f[x.v]; });

    var showResult = isContact;
    var showStage = isContact || state.act === 'media' || state.act === 'kidnap' || (state.act === 'online' && state.sub === 'groom');
    $('#resultStep').hidden = !(showResult || showStage);
    $('#result').hidden = !showResult;
    if (!showResult) state.result = 'none';
    if (!showStage) state.stage = 'done';
    chips($('#result'), RESULTS, function (v) { return state.result === v; }, function (v) { state.result = v; });
    chips($('#stage'), STAGES, function (v) { return state.stage === v; }, function (v) { state.stage = v; });
  }
  function addSub(box, title, opts, isOn, onPick) {
    var t = document.createElement('div'); t.className = 'sub-title'; t.textContent = title; box.appendChild(t);
    var c = document.createElement('div'); c.className = 'chips'; box.appendChild(c);
    chips(c, opts, isOn, onPick);
  }

  /* ── 입력 필드 ── */
  function bindInputs() {
    $('#date').value = state.date;
    $('#date').addEventListener('input', function (e) { state.date = e.target.value || E.today(); compute(); });
    [['#vAge', 'victim', 'age'], ['#vBirth', 'victim', 'birth'], ['#oAge', 'offender', 'age'], ['#oBirth', 'offender', 'birth']].forEach(function (x) {
      $(x[0]).addEventListener('input', function (e) {
        var val = e.target.value;
        state[x[1]][x[2]] = val === '' ? null : (x[2] === 'age' ? Number(val) : val);
        if (x[2] === 'birth' && val) { state[x[1]].age = null; $(x[1] === 'victim' ? '#vAge' : '#oAge').value = ''; }
        if (x[2] === 'age' && val !== '') { state[x[1]].birth = null; $(x[1] === 'victim' ? '#vBirth' : '#oBirth').value = ''; }
        compute();
      });
    });
    document.querySelectorAll('.quick').forEach(function (q) {
      q.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var id = q.getAttribute('data-quick'), who = id[0] === 'v' ? 'victim' : 'offender';
        $('#' + id).value = b.getAttribute('data-v');
        state[who].age = Number(b.getAttribute('data-v')); state[who].birth = null;
        $('#' + (who === 'victim' ? 'vBirth' : 'oBirth')).value = '';
        state[who].estimated = true;
        compute();
      });
    });
    $('#reset').addEventListener('click', function () {
      initState();
      ['#vAge', '#vBirth', '#oAge', '#oBirth'].forEach(function (s) { $(s).value = ''; });
      $('#date').value = state.date;
      renderForm(); compute(); window.scrollTo(0, 0);
    });
  }

  /* ── 결과 ── */
  var last;
  function compute() {
    var r = E.evaluate(state);
    last = r;
    var vi = r.victim, oi = r.offender;
    $('#vAgeOut').textContent = vi.known ? ('만 ' + vi.age + '세 · ' + vBand(vi)) : '';
    $('#oAgeOut').textContent = oi.known ? ('만 ' + oi.age + '세 · ' + oBand(oi)) : '';
    renderResult(r);
    renderChecklist(r, $('#checkAll'));
    var j = $('#jump');
    j.textContent = r.primary ? '결과: ' + shortName(L[r.primary.id].name) + ' ↓' : '결과 보기 ↓';
  }
  function vBand(vi) {
    var s = vi.under13 ? '13세 미만' : vi.age13to15 ? '13세 이상 16세 미만' : vi.age < 19 ? '16세 이상 19세 미만' : '19세 이상';
    return s;
  }
  function oBand(oi) {
    return { under10: '10세 미만 (처분 불가)', chokbeop: '촉법소년 (형사처벌 불가)', juvenile: '범죄소년 (19세 미만)', adult: '성인 (19세 이상)' }[oi.band];
  }
  function shortName(n) { var m = n.match(/[(〔]([^)〕]+)[)〕]$/); return m ? m[1].replace(/[()〔〕]/g, '') : n; }

  function lawBlock(h, kind) {
    var law = L[h.id];
    var stage = h.stage === 'attempt' ? '<span class="badge stage">미수</span>' : h.stage === 'prep' ? '<span class="badge stage">예비·음모</span>' : '';
    var pen = h.stage === 'prep' ? '3년 이하의 징역 (' + esc(h.stageLaw) + ')' : esc(law.pen);
    var html = '<div class="law ' + kind + (h.absorbed ? ' absorbed' : '') + '">';
    if (kind === 'primary') html += '<div class="kicker">주 적용 후보</div>';
    html += '<div class="name">' + esc(law.name) + stage + (law.verify ? '<span class="badge warn">죄명 확인</span>' : '') + '</div>';
    html += '<div class="art">' + esc(D.LAWNAME[law.g]) + ' ' + esc(law.art) + (h.stage === 'attempt' ? ' · 미수 근거: ' + esc(h.stageLaw) : '') + '</div>';
    html += '<div class="pen">' + pen + '</div>';
    if (h.why) html += '<div class="why">' + esc(h.why) + '</div>';
    if (h.cond) html += '<div class="cond">조건: ' + esc(h.cond) + '</div>';
    h.mods.forEach(function (m) { html += '<div class="mod' + (m.blocked ? ' blocked' : '') + '"><b>' + esc(m.law) + '</b> · ' + esc(m.text) + '</div>'; });
    if (h.absorbed) html += '<div class="why"><small>상해·사망 결과가 있어 결과적 가중범에 흡수됨</small></div>';
    if (law.note && kind === 'primary') html += '<div class="why"><small>' + esc(law.note) + '</small></div>';
    return html + '</div>';
  }

  function renderResult(r) {
    var out = $('#out'), html = '';
    if (r.needVictimAge) {
      out.innerHTML = '<div class="card empty">피해자 나이(또는 생년월일)를 입력하면<br>적용 법조가 나타납니다.</div>';
      return;
    }
    var vi = r.victim, oi = r.offender;
    // 연령 요약
    html += '<div class="card"><h3>연령 판정 <small>범행일 ' + esc(r.input.date) + '</small></h3><div class="ages">';
    if (vi.known) {
      html += '<div class="tagline"><b>피해자 만 ' + vi.age + '세</b>' +
        (vi.under13 ? tag('13세 미만', true) : vi.under16 ? tag('13세 이상 16세 미만', true) : '') + (vi.ac ? tag('아청법 대상(19세 미만)', true) : tag('아청법 대상 아님', false)) + (vi.child18 ? tag('아동복지법 아동(18세 미만)', true) : '') +
        (vi.disabled ? tag(vi.disabledWeak ? '장애·판단능력 미약' : '장애', true) : '') + (vi.elderly ? tag('65세 이상', true) : '') + '</div>';
    }
    html += '<div class="tagline"><b>가해자 ' + (oi.known ? '만 ' + oi.age + '세' : '나이 미상') + '</b>' +
      (oi.known ? tag(oBand(oi), true) : tag('19세 이상 요건 조문은 조건부 표시', false)) + (oi.military ? tag('군인 등', true) : '') + '</div>';
    html += '</div></div>';

    r.warnings.forEach(function (w) { html += '<div class="alert warn">⚠ ' + esc(w) + '</div>'; });

    var main = r.hits.filter(function (h) { return h.role !== 'aux'; });
    var aux = r.hits.filter(function (h) { return h.role === 'aux'; });
    html += '<div class="card"><h3>적용 법조</h3>';
    if (!main.length) html += '<div class="alert none">입력한 조건으로는 처벌 조문이 확인되지 않습니다. 아래 "적용 안 됨"과 참고 사항을 확인하고, 사실관계(나이·방법·대가 여부)를 다시 점검하세요.</div>';
    main.forEach(function (h, i) { html += lawBlock(h, i === 0 && h.primary ? 'primary' : 'compact'); if (i === 0 && h.primary && main.length > 1) html += '<div class="sub-title">함께 검토</div>'; });
    html += '</div>';

    if (aux.length) {
      html += '<div class="card"><h3>보충 검토</h3>';
      aux.forEach(function (h) { html += lawBlock(h, 'compact'); });
      html += '</div>';
    }
    if (r.excluded.length) {
      html += '<div class="card"><details class="excl"' + (r.excluded.length <= 3 ? ' open' : '') + '><summary>적용 안 됨 (' + r.excluded.length + ')</summary>';
      r.excluded.forEach(function (x) { var law = L[x.id]; html += '<div class="excl-item"><b>' + esc(D.LAWNAME[law.g] + ' ' + law.art) + '</b> ' + esc(shortName(law.name)) + '<br>' + esc(x.why) + '</div>'; });
      html += '</details></div>';
    }
    if (r.notes.length || r.sol) {
      html += '<div class="card"><h3>참고</h3><ul class="notes">';
      r.notes.forEach(function (n) { html += '<li>' + esc(n) + '</li>'; });
      if (r.sol && main.length) html += '<li><b>공소시효</b>: ' + esc(r.sol) + '</li>';
      html += '</ul></div>';
    }
    html += '<div class="card actions"><button class="btn" id="copy">보고용 요약 복사</button><button class="btn secondary" id="toCheck">현장 조치 체크리스트 ↓</button><span class="toast" id="toast"></span></div>';
    html += '<div class="card" id="checkInline"><h3>현장 조치 체크리스트</h3><div></div></div>';
    out.innerHTML = html;
    renderChecklist(r, $('#checkInline > div'));
    $('#copy').addEventListener('click', copySummary);
    $('#toCheck').addEventListener('click', function () { $('#checkInline').scrollIntoView({ behavior: 'smooth' }); });
  }
  function tag(t, on) { return '<span class="tag' + (on ? ' on' : '') + '">' + esc(t) + '</span>'; }

  function renderChecklist(r, el) {
    if (!el) return;
    var secs = C.build(r.tags || {});
    var html = '';
    secs.forEach(function (s) {
      html += '<div class="check-sec"><h4>' + esc(s.title) + '</h4>';
      s.items.forEach(function (t) { html += '<label><input type="checkbox"><span>' + esc(t) + '</span></label>'; });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function copySummary() {
    var r = last; if (!r) return;
    var lines = ['[성범죄 적용법조 검토 메모 — 참고용]'];
    lines.push('범행일: ' + r.input.date);
    lines.push('피해자: ' + (r.victim.known ? '만 ' + r.victim.age + '세 (' + vBand(r.victim) + ')' : '나이 미상') + (r.victim.disabled ? ', 장애' : ''));
    lines.push('가해자: ' + (r.offender.known ? '만 ' + r.offender.age + '세 (' + oBand(r.offender) + ')' : '나이 미상') + (r.offender.military ? ', 군인 등' : ''));
    var act = ACTS.filter(function (a) { return a.v === r.input.act; })[0];
    var line = '행위: ' + act.t;
    if (CONTACT.indexOf(r.input.act) >= 0) line += ' / 방법: ' + MEANS.filter(function (m) { return m.v === r.input.means; })[0].t;
    var fl = FLAGS.filter(function (x) { return r.input.f[x.v]; }).map(function (x) { return x.t; });
    if (fl.length) line += ' / 상황: ' + fl.join(', ');
    lines.push(line);
    if (r.input.result !== 'none') lines.push('결과: ' + RESULTS.filter(function (x) { return x.v === r.input.result; })[0].t);
    if (r.input.stage !== 'done') lines.push('진행: ' + STAGES.filter(function (x) { return x.v === r.input.stage; })[0].t);
    var main = r.hits.filter(function (h) { return h.role !== 'aux'; });
    main.forEach(function (h, i) {
      var law = L[h.id];
      lines.push((i === 0 && h.primary ? '▶ 주 적용 후보: ' : '- 함께 검토: ') + law.name + (h.stage === 'attempt' ? ' 미수' : h.stage === 'prep' ? ' 예비·음모' : '') +
        ' (' + D.LAWNAME[law.g] + ' ' + law.art + ') — ' + (h.stage === 'prep' ? '3년 이하의 징역' : law.pen) +
        h.mods.filter(function (m) { return !m.blocked; }).map(function (m) { return ' [' + m.law + ' 가중]'; }).join(''));
    });
    r.hits.filter(function (h) { return h.role === 'aux'; }).forEach(function (h) { lines.push('- 보충 검토: ' + L[h.id].name + ' (' + D.LAWNAME[L[h.id].g] + ' ' + L[h.id].art + ')'); });
    if (r.warnings.length) lines.push('※ ' + r.warnings.join('\n※ '));
    var text = lines.join('\n');
    var done = function () { $('#toast').textContent = '복사했습니다'; setTimeout(function () { var t = $('#toast'); if (t) t.textContent = ''; }, 2000); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } document.body.removeChild(ta);
  }

  /* ── 일람표 ── */
  function renderTable(q) {
    q = (q || '').trim();
    var html = '';
    D.GROUPS.forEach(function (g) {
      var rows = Object.keys(L).map(function (k) { return L[k]; }).filter(function (law) {
        if (law.g !== g.g) return false;
        if (!q) return true;
        return [law.art, law.name, law.req, law.pen, law.note || ''].join(' ').indexOf(q) >= 0;
      });
      if (!rows.length) return;
      html += '<div class="lt-group"><h3>' + esc(g.title) + '</h3>';
      rows.forEach(function (law) {
        html += '<div class="lt-row"><div class="a">' + esc(law.art) + '</div><div class="n">' + esc(law.name) + (law.verify ? '<span class="badge warn">죄명 확인</span>' : '') +
          '</div><div class="r">' + esc(law.req) + '</div><div class="p">' + esc(law.pen) + '</div>' +
          '<div class="x">미수: ' + esc(law.att || '처벌 규정 없음') + ' · 예비·음모: ' + esc(law.prep || '처벌 규정 없음') + (law.note ? ' · ' + esc(law.note) : '') + '</div></div>';
      });
      html += '</div>';
    });
    $('#lawTable').innerHTML = html || '<p class="hint">검색 결과가 없습니다.</p>';
  }

  /* ── 탭 ── */
  function bindTabs() {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        document.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.hidden = p.id !== 'tab-' + t; });
        window.scrollTo(0, 0);
      });
    });
  }

  function init() {
    initState();
    bindTabs(); bindInputs(); renderForm(); compute();
    renderTable('');
    $('#q').addEventListener('input', function (e) { renderTable(e.target.value); });
    $('#sources').innerHTML = '<p>법령 원문 대조일: <b>' + esc(D.META.checkedAt) + '</b></p><ul>' +
      D.META.sources.map(function (s) { return '<li>' + esc(s.law) + ' — ' + esc(s.ver) + '</li>'; }).join('') + '</ul>' +
      '<p>원문: <a href="https://www.law.go.kr" target="_blank" rel="noopener">국가법령정보센터</a></p>';
    $('#footMeta').textContent = '법령 기준 ' + D.META.checkedAt + ' · 참고용 도구이며 법률 판단을 대신하지 않습니다 · 입력값은 저장·전송되지 않습니다';
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  init();
})();
