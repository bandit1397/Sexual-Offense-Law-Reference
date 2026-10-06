/*
 * 판정 엔진: 현장 입력 → 적용 가능 법조 목록
 * 원칙
 *  1. 요건을 충족하는 조문을 모두 모은다.
 *  2. 법정형이 가장 무거운 특별규정을 "주 적용 후보"로, 나머지는 "함께 검토"로 표시한다.
 *  3. 요건이 빠져 적용되지 않는 조문도 이유와 함께 보여준다 (현장 착오 방지).
 * 최종 법적 판단은 수사부서가 한다. 이 엔진은 참고용이다.
 */
(function (root) {
  'use strict';

  var D = (typeof module !== 'undefined' && module.exports) ? require('./laws.js') : root.LawData;
  var L = D.LAWS;

  var DATE_AC_MAN_AGE = '2024-06-27'; // 아청법 '연 나이' 단서 삭제 시행일
  var DATE_2020_REFORM = '2020-05-19'; // 의제강간 16세 확대 등 대개정

  function ymd(s) { return s ? String(s).slice(0, 10) : null; }
  function ageAt(birth, date) {
    var b = ymd(birth).split('-').map(Number), d = ymd(date).split('-').map(Number);
    var a = d[0] - b[0];
    if (d[1] < b[1] || (d[1] === b[1] && d[2] < b[2])) a--;
    return a;
  }
  function today() {
    var t = new Date(); var m = t.getMonth() + 1, d = t.getDate();
    return t.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function severity(p, factor) {
    factor = factor || 1;
    var max = (p.max != null ? p.max : (p.min ? 30 : 0));
    return (p.d ? 100000 : 0) + (p.l ? 10000 : 0) + (p.min || 0) * factor * 100 + max * factor - (p.fine ? 50 : 0);
  }

  var KIND_LABEL = { r: '간음(성교)', p: '삽입행위(유사강간)', t: '추행' };

  function evaluate(input) {
    var inp = normalize(input);
    var out = {
      input: inp, victim: null, offender: null,
      hits: [], excluded: [], notes: [], warnings: [], tags: {}
    };
    var date = inp.date;

    /* ── 연령 판정 ── */
    var v = inp.victim, o = inp.offender;
    var vAge = v.birth ? ageAt(v.birth, date) : v.age;
    var oAge = o.birth ? ageAt(o.birth, date) : o.age;
    var vi = { age: vAge, known: vAge != null };
    if (vi.known) {
      vi.under13 = vAge < 13;
      vi.age13to15 = vAge >= 13 && vAge < 16;
      vi.under16 = vAge < 16;
      vi.child18 = vAge < 18;              // 아동복지법 아동
      vi.minorCivil = vAge < 19;           // 민법상 미성년자(형법 제302조)
      vi.ac = vAge < 19;                   // 아청법 아동·청소년
      vi.elderly = vAge >= 65;
      if (date < DATE_AC_MAN_AGE && vAge === 18) {
        if (v.birth) {
          var by = Number(ymd(v.birth).slice(0, 4)), dy = Number(date.slice(0, 4));
          if (dy - by >= 19) {
            vi.ac = false;
            out.warnings.push('범행일이 2024.6.27. 이전이고 피해자가 19세가 되는 해의 1월 1일을 이미 지났으므로, 행위 당시 아청법의 아동·청소년에서 제외됩니다 (구 아청법 제2조제1호 단서).');
          }
        } else {
          out.warnings.push('범행일이 2024.6.27. 이전이고 피해자가 만 18세입니다. 당시에는 "19세가 되는 해의 1월 1일을 맞은 사람"이 아청법 대상에서 빠졌습니다. 생년월일을 입력해야 정확히 판정할 수 있습니다.');
        }
      }
    }
    vi.disabled = v.disability !== 'none';
    vi.disabledWeak = v.disability === 'weak';
    vi.military = !!v.military;
    out.victim = vi;

    var oi = { age: oAge, known: oAge != null };
    if (oi.known) {
      oi.adult19 = oAge >= 19;
      oi.criminalMinor = oAge < 14;
      oi.band = oAge < 10 ? 'under10' : oAge < 14 ? 'chokbeop' : oAge < 19 ? 'juvenile' : 'adult';
    }
    oi.military = !!o.military;
    out.offender = oi;

    /* ── 공통 경고 ── */
    if (vi.known) {
      if ([12, 13, 15, 16, 18, 19].indexOf(vAge) >= 0 && !v.birth)
        out.warnings.push('피해자 나이가 기준 연령(13·16·19세) 경계에 있습니다. 생년월일로 범행일 당시 만 나이를 정확히 확인하세요.');
    }
    if (oi.known && [18, 19, 13, 14].indexOf(oAge) >= 0 && !o.birth)
      out.warnings.push('가해자 나이가 기준 연령(14·19세) 경계에 있습니다. 생년월일로 범행일 당시 만 나이를 확인하세요.');
    if (date < DATE_2020_REFORM)
      out.warnings.push('범행일이 2020.5.19. 이전입니다. 행위 당시 법률이 적용되며(의제강간 16세 확대, 13세 미만 강제추행 벌금형 삭제, 촬영물 소지 처벌 등은 이후 신설), 이 도구는 현행법 기준입니다.');

    if (oi.known) {
      if (oi.band === 'under10') out.warnings.push('가해자가 10세 미만: 형사처벌·보호처분 모두 불가합니다. 피해자 보호, 보호자 통보, 아동보호 연계에 집중하세요.');
      else if (oi.band === 'chokbeop') out.warnings.push('가해자가 10세 이상 14세 미만(촉법소년): 형벌을 받지 않으며(형법 제9조) 소년부 보호사건으로 송치됩니다(소년법 제4조제1항제2호·제2항). 아래 법조는 사실관계를 정리하는 용도로 보세요.');
      else if (oi.band === 'juvenile') out.notes.push('가해자가 14세 이상 19세 미만(범죄소년): 형사처벌 또는 소년보호사건 대상입니다(소년법). 보호자에게 연락하세요.');
    }
    if (oi.military) out.notes.push('가해자가 군인 등: 평시에는 군인 등이 저지른 성폭력처벌법 제2조의 성폭력범죄와 아청법상 성범죄를 일반 법원이 재판합니다(군사법원법 제2조제2항제1호, 2022.7.1. 시행). 경찰이 수사하고 소속 부대에 통보하세요.');

    if (!vi.known && inp.act !== 'exposure' && inp.act !== 'intrusion') {
      out.needVictimAge = true;
    }

    /* ── 행위별 판정 ── */
    var ctx = { inp: inp, vi: vi, oi: oi, out: out };
    switch (inp.act) {
      case 'r': case 'p': case 't': contact(ctx, inp.act); break;
      case 'buying': buying(ctx); break;
      case 'media': media(ctx); break;
      case 'online': online(ctx); break;
      case 'exposure': exposure(ctx); break;
      case 'intrusion': intrusion(ctx); break;
      case 'abuse': abuse(ctx); break;
      case 'kidnap': kidnap(ctx); break;
    }

    applyStage(ctx);
    applyAggravation(ctx);
    statuteOfLimitations(ctx);
    rank(out);
    buildTags(ctx);
    return out;
  }

  function normalize(x) {
    x = x || {};
    var n = {
      date: ymd(x.date) || today(),
      victim: Object.assign({ age: null, birth: null, disability: 'none', military: false }, x.victim || {}),
      offender: Object.assign({ age: null, birth: null, military: false }, x.offender || {}),
      act: x.act || 'r',
      means: x.means || 'force',
      sub: x.sub || null,          // 행위별 세부 (media/online/buying/abuse)
      buyKind: x.buyKind || 'r',
      synthetic: !!x.synthetic,
      profit: !!x.profit,
      f: Object.assign({}, x.f || {}),  // 상황 플래그
      result: x.result || 'none',
      stage: x.stage || 'done'
    };
    ['age'].forEach(function (k) {
      if (n.victim[k] === '' || n.victim[k] == null || isNaN(n.victim[k])) n.victim[k] = null; else n.victim[k] = Number(n.victim[k]);
      if (n.offender[k] === '' || n.offender[k] == null || isNaN(n.offender[k])) n.offender[k] = null; else n.offender[k] = Number(n.offender[k]);
    });
    if (!n.victim.birth) n.victim.birth = null;
    if (!n.offender.birth) n.offender.birth = null;
    return n;
  }

  function add(ctx, id, why, extra) {
    var law = L[id];
    if (!law) throw new Error('unknown law ' + id);
    var h = Object.assign({ id: id, why: why || '', mods: [], role: 'hit' }, extra || {});
    if (law.since && ctx.inp.date < law.since) {
      exclude(ctx, id, '범행일(' + ctx.inp.date + ')에는 이 조문이 시행 전이었습니다 (' + law.since + ' 시행).');
      return null;
    }
    // 중복 제거
    for (var i = 0; i < ctx.out.hits.length; i++) if (ctx.out.hits[i].id === id) return ctx.out.hits[i];
    ctx.out.hits.push(h);
    return h;
  }
  function exclude(ctx, id, why) {
    for (var i = 0; i < ctx.out.excluded.length; i++) if (ctx.out.excluded[i].id === id) return;
    ctx.out.excluded.push({ id: id, why: why });
  }
  function note(ctx, s) { if (ctx.out.notes.indexOf(s) < 0) ctx.out.notes.push(s); }
  function warn(ctx, s) { if (ctx.out.warnings.indexOf(s) < 0) ctx.out.warnings.push(s); }

  // 가해자 19세 이상 요건 처리: 모르면 조건부로 추가
  function needAdult(ctx, id, why) {
    var oi = ctx.oi;
    if (!oi.known) return add(ctx, id, why, { cond: '가해자가 19세 이상인 경우에만 적용' });
    if (oi.adult19) return add(ctx, id, why);
    exclude(ctx, id, '가해자가 19세 미만이라 적용되지 않습니다 (가해자 19세 이상 요건).');
    return null;
  }

  /* ───────── 신체 접촉형 (간음/삽입/추행) ───────── */
  function contact(ctx, k) {
    var inp = ctx.inp, vi = ctx.vi, f = inp.f, m = inp.means;
    var forceLike = (m === 'force' || m === 'surprise');
    var K = KIND_LABEL[k];
    var milBoth = ctx.oi.military && vi.military;

    if (m === 'surprise') {
      if (k === 't') note(ctx, '기습추행: 판례는 폭행행위 자체가 추행으로 인정되면 힘의 크기를 따지지 않고 강제추행으로 봅니다 (대법원 판례).');
      else warn(ctx, '간음·삽입행위를 "기습"으로 선택했습니다. 폭행·협박 정도를 구체적으로 확인하세요.');
    }

    /* 결합범·특수강도 */
    if (forceLike || m === 'incap') {
      if (f.specialRobbery) add(ctx, 'sp3_2', '특수강도(미수 포함)를 범한 사람의 ' + K);
      else if (f.robbery && k === 'r' && forceLike) add(ctx, 'hy339', '강도가 강간');
      else if (f.robbery) note(ctx, '강도 + ' + K + ': 형법 제339조(강도강간)는 강간에만 적용됩니다. 강도죄와 해당 성범죄의 경합을 검토하세요.');

      if (f.homeInvasion || f.burglary) {
        var onlyHome = f.homeInvasion && !f.burglary;
        if (onlyHome && k === 't') {
          exclude(ctx, 'sp3_1', '주거침입 후 강제추행·준강제추행 부분은 헌법재판소 위헌결정(2021헌가9, 2023.2.23.)으로 적용할 수 없습니다.');
          add(ctx, 'hy319', '주거침입 (성폭력처벌법 제3조제1항 위헌 부분 → 주거침입죄와 추행죄의 경합으로 처리)');
        } else {
          add(ctx, 'sp3_1', (f.burglary ? '야간주거침입절도·특수절도' : '주거침입') + ' 후 ' + K);
          note(ctx, '성폭력처벌법 제3조제1항은 주거침입 등이 먼저 기수에 이른 뒤 성범죄를 저지른 경우에 적용합니다.');
        }
      }
    }

    if (forceLike) {
      if (f.weapon || f.group) {
        if (k === 'r') add(ctx, 'sp4_1', (f.weapon ? '흉기·위험한 물건 휴대' : '2명 이상 합동') + ' + 강간');
        else if (k === 't') add(ctx, 'sp4_2', (f.weapon ? '흉기·위험한 물건 휴대' : '2명 이상 합동') + ' + 강제추행');
        else exclude(ctx, 'sp4_1', '성폭력처벌법 제4조는 강간·강제추행만 규정하며 유사강간은 대상이 아닙니다. 기본 조문에 흉기 휴대·합동을 양형 요소로 반영합니다.');
      }
      if (f.kin) {
        if (k === 'r') add(ctx, 'sp5_1', '친족관계 + 폭행·협박으로 강간');
        else if (k === 't') add(ctx, 'sp5_2', '친족관계 + 폭행·협박으로 강제추행');
        else exclude(ctx, 'sp5_1', '성폭력처벌법 제5조는 강간·강제추행·준강간·준강제추행만 규정하며 유사강간은 대상이 아닙니다.');
      }
      if (vi.disabled) add(ctx, k === 'r' ? 'sp6_1' : k === 'p' ? 'sp6_2' : 'sp6_3', '피해자에게 신체적·정신적 장애 + 폭행·협박으로 ' + K);
      if (vi.under13) add(ctx, k === 'r' ? 'sp7_1' : k === 'p' ? 'sp7_2' : 'sp7_3', '피해자 13세 미만 + 폭행·협박으로 ' + K);
      if (vi.ac) add(ctx, k === 'r' ? 'ac7_1' : k === 'p' ? 'ac7_2' : 'ac7_3', '피해자 19세 미만(아동·청소년) + 폭행·협박으로 ' + K);
      if (milBoth) add(ctx, k === 'r' ? 'm92' : k === 'p' ? 'm92_2' : 'm92_3', '가해자·피해자 모두 군인 등');
      add(ctx, k === 'r' ? 'hy297' : k === 'p' ? 'hy297_2' : 'hy298', '폭행·협박으로 ' + K + ' (일반 규정)');
      if (f.crowded && k === 't') {
        add(ctx, 'sp11', '공중 밀집 장소에서 추행');
        note(ctx, '공중밀집장소추행(성폭력처벌법 제11조)은 폭행·협박이 없어도 성립합니다. 폭행·협박(기습 포함)이 인정되면 강제추행이 우선 검토됩니다.');
      }
    }

    if (m === 'incap') {
      note(ctx, '"심신상실·항거불능"에는 깊은 잠, 만취, 약물로 인한 의식상실, 기절 등이 포함됩니다. 약물 의심 시 즉시 소변·혈액 채취가 필요합니다.');
      if (f.weapon || f.group) {
        if (k === 'r') add(ctx, 'sp4_3r', '흉기 휴대·합동 + 준강간');
        else if (k === 't') add(ctx, 'sp4_3t', '흉기 휴대·합동 + 준강제추행');
      }
      if (f.kin) {
        if (k === 'r') add(ctx, 'sp5_3r', '친족관계 + 준강간');
        else if (k === 't') add(ctx, 'sp5_3t', '친족관계 + 준강제추행');
        else exclude(ctx, 'sp5_3r', '성폭력처벌법 제5조제3항은 준강간·준강제추행만 규정합니다.');
      }
      if (vi.disabled) add(ctx, 'sp6_4' + k, '장애로 인한 항거불능·항거곤란 상태를 이용한 ' + K, { cond: '항거불능·곤란이 "장애로 인한" 것일 때 (술·약물로 인한 것이면 준강간 등 일반 규정)' });
      if (vi.under13) add(ctx, 'sp7_4' + k, '13세 미만의 심신상실·항거불능 상태 이용 ' + K);
      if (vi.ac) add(ctx, 'ac7_4' + k, '아동·청소년의 심신상실·항거불능 상태 이용 ' + K);
      if (milBoth) add(ctx, 'm92_4' + k, '가해자·피해자 모두 군인 등');
      add(ctx, 'hy299_' + k, '심신상실·항거불능 상태 이용 ' + K + ' (일반 규정)');
    }

    if (m === 'deceit') {
      note(ctx, '위계: 속임수(거짓 치료·거짓 교제 약속 등)로 오인·착각을 일으켜 간음·추행. 위력: 지위·권세·물리력 등으로 의사를 제압할 만한 힘 (폭행·협박에 이르지 않아도 됨).');
      if (vi.under13) add(ctx, 'sp7_5' + k, '위계·위력으로 13세 미만 ' + K);
      if (vi.disabled) {
        if (k === 'r') add(ctx, 'sp6_5', '위계·위력으로 장애인 간음');
        else add(ctx, 'sp6_6', '위계·위력으로 장애인 ' + K);
      }
      if (vi.ac) add(ctx, 'ac7_5' + k, '위계·위력으로 아동·청소년 ' + K);
      if (vi.minorCivil || vi.disabledWeak) add(ctx, 'hy302', '위계·위력으로 ' + (vi.minorCivil ? '미성년자' : '심신미약자') + ' ' + K);
      if (f.workplace) {
        if (k === 'r') add(ctx, 'hy303_1', '업무·고용 등 보호·감독 관계 + 위계·위력 간음');
        else add(ctx, 'sp10_1', '업무·고용 등 보호·감독 관계 + 위계·위력 ' + K);
      }
      if (f.kin) note(ctx, '친족관계 강간 등(성폭력처벌법 제5조)은 폭행·협박 또는 준강간 형태여야 합니다. 위계·위력만 있으면 다른 조문으로 처리합니다.');
      if (!vi.under13 && !vi.disabled && !vi.ac && !vi.minorCivil && !f.workplace)
        note(ctx, '피해자가 19세 이상 비장애인이고 보호·감독 관계가 없으면 위계·위력 간음·추행 처벌 조문이 없습니다. 폭행·협박 또는 항거불능 이용 여부를 다시 확인하세요.');
    }

    if (m === 'distress') {
      note(ctx, '궁박: 경제적 곤궁, 가출로 잘 곳이 없는 상태 등 급박하고 곤란한 처지.');
      if (vi.known && vi.age13to15 && !vi.disabledWeak) needAdult(ctx, k === 'r' ? 'ac8b_1' : 'ac8b_2', '13세 이상 16세 미만의 궁박한 상태 이용 ' + K);
      else if (vi.known && !vi.age13to15) exclude(ctx, 'ac8b_1', '아청법 제8조의2는 피해자가 13세 이상 16세 미만일 때만 적용됩니다.');
      else if (vi.disabledWeak) exclude(ctx, 'ac8b_1', '장애 아동·청소년은 아청법 제8조로 판단합니다 (제8조의2 제외 대상).');
    }

    // 강제수단 요건이 없는 조문 — 수단과 무관하게 연령으로 성립
    if (m !== 'force' && m !== 'surprise' && m !== 'incap') {
      if (vi.under13) add(ctx, 'hy305_1_' + k, '13세 미만 ' + K + ': 동의 여부·가해자 나이 무관');
      if (vi.known && vi.age13to15) {
        var h = needAdult(ctx, 'hy305_2_' + k, '13세 이상 16세 미만 ' + K + ' (가해자 19세 이상): 동의 여부 무관');
        if (!h && ctx.oi.known) note(ctx, '13세 이상 16세 미만 피해자이지만 가해자가 19세 미만이므로 형법 제305조제2항이 적용되지 않습니다. 강제수단·위계·위력·대가 여부를 다시 확인하세요.');
      }
      if (vi.disabledWeak && vi.ac && vi.known && vi.age >= 13) needAdult(ctx, k === 'r' ? 'ac8_1' : 'ac8_2', '13세 이상 장애 아동·청소년(사물변별·의사결정 능력 미약) ' + K);
    }
    if (vi.disabledWeak && vi.ac && vi.known && vi.age >= 13 && (m === 'force' || m === 'surprise' || m === 'incap'))
      needAdult(ctx, k === 'r' ? 'ac8_1' : 'ac8_2', '13세 이상 장애 아동·청소년(사물변별·의사결정 능력 미약) ' + K);

    if (m === 'none') {
      if (vi.disabled && !vi.ac) note(ctx, '장애인 피해자가 장애 때문에 저항하기 어려웠다면 수단을 "항거불능·곤란 이용"으로 바꿔 보세요 (성폭력처벌법 제6조제4항).');
      if (!vi.under13 && !(vi.age13to15) && !vi.disabledWeak && !f.custody)
        note(ctx, '강제수단·위계·위력이 없고 연령 요건(13세 미만, 13~16세 미만 + 가해자 19세 이상)도 없으면 성폭력범죄가 성립하지 않을 수 있습니다. 대가가 오갔다면 "대가(성매수·성매매)"를 선택하세요.');
    }

    // 피구금자: 수단 무관
    if (f.custody) add(ctx, k === 'r' ? 'hy303_2' : 'sp10_2', '법률에 따라 구금된 사람을 감호자가 ' + K + ' (폭행·협박 불요)');

    // 보충 검토 법률
    if (vi.child18 && (k === 't') && m !== 'force' && m !== 'surprise' && m !== 'incap')
      add(ctx, 'cw17_2', '18세 미만 아동에 대한 성적 학대행위로 별도 검토', { role: 'aux' });
    if (vi.disabled) add(ctx, 'dw59_9', '장애인에 대한 성폭력·성희롱 행위 (보충 검토)', { role: 'aux' });
    if (vi.elderly) add(ctx, 'ow39_9', '65세 이상 노인에 대한 성폭행·성희롱 행위 (보충 검토)', { role: 'aux' });
    if (ctx.oi.military && !vi.military) note(ctx, '군형법 제92조 계열은 피해자도 군인 등일 때만 적용됩니다. 민간인 피해자는 형법·성폭력처벌법·아청법으로 판단합니다.');

    applyResult(ctx, k);
  }

  /* 결과적 가중 (상해·치상·살인·치사) */
  function applyResult(ctx, k) {
    var r = ctx.inp.result; if (r === 'none') return;
    if (ctx.inp.stage === 'prep') return;
    var ids = ctx.out.hits.map(function (h) { return h.id; });
    function has(prefixes) { return ids.some(function (id) { return prefixes.some(function (p) { return id.indexOf(p) === 0; }); }); }
    var spAny = has(['sp3_', 'sp4_', 'sp5_', 'sp6_', 'sp7_']);
    var sp8_1 = has(['sp3_1', 'sp4_', 'sp6_', 'sp7_']);
    var sp5 = has(['sp5_']);
    var ac7 = has(['ac7_']);
    var hyBase = has(['hy297', 'hy299', 'hy305', 'hy298']);
    var mil = has(['m92']);
    var resultLabel = { injury: '상해(고의)', hurt: '치상(상해의 결과)', murder: '살해', death: '사망(치사)' }[r];
    var added = [];

    if (r === 'injury' || r === 'hurt') {
      if (sp8_1) added.push(add(ctx, 'sp8_1', '성폭력처벌법 제3조제1항·제4조·제6조·제7조의 죄 + ' + resultLabel));
      if (sp5) added.push(add(ctx, 'sp8_2', '친족관계 강간 등 + ' + resultLabel));
      if (ac7) added.push(add(ctx, 'ac9', '아청법 제7조의 죄 + ' + resultLabel));
      if (hyBase) added.push(add(ctx, 'hy301', '형법상 강간 등' + (has(['hy305']) ? '(제305조 의제강간 등 포함)' : '') + ' + ' + resultLabel));
      if (mil) added.push(add(ctx, 'm92_7', '군형법 강간 등 + ' + resultLabel));
      if (has(['sp3_2'])) note(ctx, '특수강도강간 등 + 상해: 성폭력처벌법 제8조 대상이 아닙니다. 특수강도강간(사형·무기·10년 이상)과 강도상해(형법 제337조)를 검토하세요.');
      if (r === 'hurt') note(ctx, '치상: 강간 등의 기회에 상해 결과가 발생한 경우(과실 포함). 판례는 일상생활에 지장이 없는 극히 경미한 상처는 상해로 보지 않습니다. 진단서를 확보하세요.');
    }
    if (r === 'murder') {
      if (spAny || hyBase) added.push(add(ctx, 'sp9_1', '강간 등(성폭력처벌법 제3~7조 또는 형법 제297~300조) + 살해'));
      if (ac7) added.push(add(ctx, 'ac10_1', '아청법 제7조의 죄 + 살해'));
      if (hyBase) added.push(add(ctx, 'hy301_2k', '형법상 강간 등 + 살해'));
      if (mil) added.push(add(ctx, 'm92_8k', '군형법 강간 등 + 살해'));
    }
    if (r === 'death') {
      if (has(['sp4_', 'sp5_'])) added.push(add(ctx, 'sp9_2', '특수·친족 강간 등 + 사망'));
      if (has(['sp6_', 'sp7_'])) added.push(add(ctx, 'sp9_3', '장애인·13세 미만 강간 등 + 사망'));
      if (ac7) added.push(add(ctx, 'ac10_2', '아청법 제7조의 죄 + 사망'));
      if (hyBase) added.push(add(ctx, 'hy301_2d', '형법상 강간 등 + 사망'));
      if (mil) added.push(add(ctx, 'm92_8d', '군형법 강간 등 + 사망'));
    }
    added = added.filter(Boolean);
    if (added.length) {
      added.forEach(function (h) { h.result = true; });
      ctx.out.hits.forEach(function (h) { if (!h.result && h.role === 'hit') h.absorbed = true; });
      note(ctx, '상해·사망 결과가 있으면 결과적 가중범(아래 주 적용)이 기본 범죄를 흡수합니다. 기본 범죄가 미수여도 결과적 가중범은 성립합니다.');
    } else if (ctx.out.hits.length) {
      note(ctx, '선택한 기본 범죄에는 상해·사망 결과에 대한 가중 규정이 없습니다. 상해죄(형법 제257조)·과실치상·살인죄 등과의 경합을 검토하세요.');
    }
  }

  /* ───────── 대가(성매수·성매매) ───────── */
  function buying(ctx) {
    var vi = ctx.vi, inp = ctx.inp, k = inp.buyKind;
    var lure = inp.sub === 'lure';
    if (vi.known && vi.ac) {
      var h = add(ctx, lure ? 'ac13_2' : 'ac13_1', lure ? '성을 사기 위해 아동·청소년을 유인·권유' : '대가를 주고(약속하고) 아동·청소년의 성을 삼');
      if (h && (vi.under16 || vi.disabledWeak)) h.mods.push({ law: '아청법 제13조제3항', text: '16세 미만 또는 장애 아동·청소년 대상: 형의 1/2까지 가중', factor: 1.5 });
      note(ctx, '아동·청소년 성매수는 아동·청소년의 동의·자발성과 무관하게 처벌하며, 아동·청소년은 처벌 대상이 아닙니다(피해자로 보호).');
      if (!lure) {
        if (vi.under13) add(ctx, 'hy305_1_' + k, '13세 미만과 성적 행위: 대가·동의 무관 의제강간 등 (성매수죄와 함께 검토)');
        else if (vi.age13to15) needAdult(ctx, 'hy305_2_' + k, '13세 이상 16세 미만과 성적 행위 (가해자 19세 이상): 의제강간 등');
        if (vi.disabledWeak && vi.age >= 13) needAdult(ctx, k === 'r' ? 'ac8_1' : 'ac8_2', '장애 아동·청소년 간음·추행');
      }
      add(ctx, 'ac15b', '성매수를 위한 유인·권유가 성착취 목적 대화 형태였다면 함께 검토', { role: 'aux', cond: '가해자 19세 이상' });
    } else if (vi.known) {
      if (lure) note(ctx, '19세 이상 상대의 단순 유인·권유는 성매매처벌법상 알선·권유 등(제19조 등) 해당 여부를 확인하세요.');
      else add(ctx, 'pr21', '19세 이상 상대 성매매 (성매도자·성매수자 모두 처벌 대상, 성매매피해자는 제외)');
    }
  }

  /* ───────── 촬영물·영상 ───────── */
  function media(ctx) {
    var inp = ctx.inp, vi = ctx.vi, s = inp.sub || 'film', syn = inp.synthetic;
    var minor = vi.known && vi.ac;
    var acMap = { film: 'ac11_1', dist: inp.profit ? 'ac11_2' : 'ac11_3', possess: 'ac11_5', threat: 'ac11b_1', coerce: 'ac11b_2' };

    if (minor) {
      add(ctx, acMap[s], '아동·청소년이 등장하는 성적 촬영물·합성물 = 아동·청소년성착취물' + (s === 'film' ? ' (동의·자발 촬영도 제작에 해당)' : ''));
      note(ctx, '아동·청소년성착취물: 아동·청소년 또는 아동·청소년으로 명백하게 인식될 수 있는 사람·표현물이 성적 행위를 하거나 신체를 노출하는 내용 (아청법 제2조제5호). 성인 대상보다 훨씬 무겁게 처벌됩니다.');
    }
    if (!syn) {
      var m1 = { film: 'sp14_1', dist: inp.profit ? 'sp14_3' : 'sp14_2', possess: 'sp14_4', threat: 'sp14c_1', coerce: 'sp14c_2' };
      add(ctx, m1[s], {
        film: '성적 욕망·수치심을 유발할 수 있는 신체를 의사에 반하여 촬영',
        dist: inp.profit ? '영리 목적 + 정보통신망으로 불법촬영물 반포' : '불법촬영물(또는 동의 촬영 후 의사에 반한) 반포등',
        possess: '불법촬영물 소지·구입·저장·시청',
        threat: '성적 촬영물을 이용한 협박',
        coerce: '촬영물 협박으로 권리행사 방해·의무 없는 일 강요'
      }[s]);
      if (s === 'dist' && inp.profit) add(ctx, 'sp14_2', '영리 목적이 인정되지 않으면 일반 반포등');
      if (s === 'film') note(ctx, '촬영 당시 동의했더라도 나중에 의사에 반해 유포하면 제14조제2항으로 처벌합니다. 자신의 신체를 직접 찍어 보낸 사진을 유포한 경우도 같습니다.');
    } else {
      var m2 = { film: 'sp14b_1', dist: inp.profit ? 'sp14b_3' : 'sp14b_2', possess: 'sp14b_4', threat: 'sp14c_1', coerce: 'sp14c_2' };
      add(ctx, m2[s], {
        film: '얼굴·신체·음성을 의사에 반해 성적으로 편집·합성·가공 (딥페이크)',
        dist: '허위영상물 반포등', possess: '허위영상물 소지·구입·저장·시청',
        threat: '허위영상물을 이용한 협박', coerce: '허위영상물 협박으로 강요'
      }[s]);
    }
    if (s === 'threat' || s === 'coerce') note(ctx, '촬영물 협박으로 실제 성관계·추행을 강요했다면 강간·강제추행 등을 별도로 검토하세요 (행위 유형을 바꿔 다시 판정).');
    if (s === 'dist') note(ctx, '유포가 확인되면 사법경찰관리는 지체 없이 방송미디어통신심의위원회 등에 삭제·접속차단을 요청해야 합니다 (성폭력처벌법 제23조의2).');
    if (s === 'film' && inp.f.intrusionPlace) add(ctx, 'sp12', '촬영 목적으로 화장실·탈의실 등 다중이용장소 침입');
    if (inp.f.habitual && (s === 'film' || s === 'dist')) {
      ctx.out.hits.forEach(function (h) {
        if (/^sp14/.test(h.id)) h.mods.push({ law: syn ? '성폭력처벌법 제14조의2제5항' : '성폭력처벌법 제14조제5항', text: '상습: 형의 1/2까지 가중', factor: 1.5 });
      });
    }
  }

  /* ───────── 온라인·통신 ───────── */
  function online(ctx) {
    var inp = ctx.inp, vi = ctx.vi, s = inp.sub || 'lewd';
    if (s === 'lewd') {
      add(ctx, 'sp13', '성적 목적으로 통신매체를 통해 성적 수치심·혐오감을 일으키는 말·글·사진·영상을 상대방에게 보냄');
      if (vi.known && vi.ac) needAdult(ctx, 'ac15b', '아동·청소년에게 성적 대화를 지속·반복했다면 성착취 목적 대화 (함께 검토)');
      if (vi.known && vi.child18) add(ctx, 'cw17_2', '아동에 대한 성희롱 등 성적 학대로 함께 검토', { role: 'aux' });
      note(ctx, '자신의 신체 촬영물을 보낸 경우도 제13조에 해당합니다. 반복적으로 연락해 불안감·공포심을 주면 스토킹범죄도 검토하세요.');
      add(ctx, 'st18', '반복·지속적 연락으로 불안감·공포심 유발 시', { role: 'aux' });
    } else { // groom
      if (vi.known && !vi.ac) { exclude(ctx, 'ac15b', '피해자가 19세 이상이라 아청법 제15조의2가 적용되지 않습니다.'); add(ctx, 'sp13', '성적 메시지 전송'); return; }
      needAdult(ctx, 'ac15b', '성적 착취 목적으로 아동·청소년과 성적 대화 지속·반복 또는 성매수 행위 유인·권유' + (vi.under16 ? ' (16세 미만: 목적 요건 없이 처벌, 제2항)' : ''));
      if (inp.date < '2025-04-22') warn(ctx, '범행일이 2025.4.22. 이전이면 제15조의2제2항(16세 미만)은 정보통신망을 통한 행위만 처벌했고 미수 처벌규정이 없었습니다.');
      add(ctx, 'sp13', '성적 메시지·사진 전송이 있었다면 함께 검토');
      note(ctx, '대화 중 성적 촬영물을 요구해 받았다면 아청법 제11조(성착취물 제작) 검토 — 행위 유형 "촬영물·영상"으로 다시 판정하세요.');
    }
  }

  /* ───────── 노출 ───────── */
  function exposure(ctx) {
    var vi = ctx.vi;
    add(ctx, 'hy245', '공연히 음란한 행위 (성기 노출 + 자위행위 등 성적 의미가 뚜렷한 행위)', { cond: '성적 의미가 있는 "음란한 행위"일 것' });
    add(ctx, 'mo33', '공개된 장소에서 주요 부위를 노출해 불쾌감을 준 정도 (음란행위에 이르지 않은 경우)', { cond: '음란행위에 이르지 않은 단순 노출' });
    note(ctx, '구분: 성기를 드러내고 자위하거나 성적 행위를 보인 경우는 공연음란, 단순히 엉덩이·성기 등을 드러낸 정도는 경범죄(과다노출). 판단이 애매하면 공연음란으로 입건해 수사부서 판단을 받으세요.');
    if (vi.known && vi.child18) add(ctx, 'cw17_2', '특정 아동을 상대로 음란행위를 보여준 경우 아동에 대한 성적 학대로 검토', { role: 'aux' });
    if (ctx.inp.f.crowded) note(ctx, '노출과 함께 신체 접촉이 있었다면 행위 유형을 "추행"으로 바꿔 다시 판정하세요.');
  }

  /* ───────── 성적 목적 장소 침입 ───────── */
  function intrusion(ctx) {
    add(ctx, 'sp12', '성적 욕망을 만족시킬 목적으로 화장실·목욕장·탈의실·모유수유시설 등에 침입 또는 퇴거불응');
    add(ctx, 'hy319', '사람의 주거·관리하는 건조물 침입이 함께 인정되면 검토', { role: 'aux' });
    note(ctx, '안에서 촬영했다면 "촬영물·영상"을, 신체 접촉이 있었다면 "추행"을 추가로 판정하세요.');
  }

  /* ───────── 성적 학대·성희롱 ───────── */
  function abuse(ctx) {
    var vi = ctx.vi, any = false;
    if (vi.known && vi.child18) { add(ctx, 'cw17_2', '18세 미만 아동에게 음란한 행위를 시키거나 매개, 성희롱 등 성적 학대'); any = true; }
    else if (vi.known) exclude(ctx, 'cw17_2', '피해자가 18세 이상이라 아동복지법상 아동이 아닙니다.');
    if (vi.disabled) { add(ctx, 'dw59_9', '장애인에게 성적 수치심을 주는 성희롱·성폭력 등'); any = true; }
    if (vi.elderly) { add(ctx, 'ow39_9', '65세 이상 노인에게 성적 수치심을 주는 성폭행·성희롱 등'); any = true; }
    if (!any) note(ctx, '성인(비장애·65세 미만)에 대한 말로 하는 성희롱 자체를 처벌하는 형벌 조문은 없습니다. 통신매체를 이용했다면 "온라인·통신", 신체 접촉이 있었다면 "추행"으로 다시 판정하세요.');
    if (vi.known && vi.child18) note(ctx, '보호자·가족에 의한 경우 아동학대처벌법상 응급조치(가해자와 분리, 보호시설 인도 등)를 검토하세요.');
  }

  /* ───────── 약취·유인 ───────── */
  function kidnap(ctx) {
    var vi = ctx.vi;
    add(ctx, 'hy288', '추행·간음 목적으로 약취(폭행·협박으로 데려감) 또는 유인(속여서 데려감)');
    if (vi.known && vi.minorCivil) add(ctx, 'hy287', '미성년자 약취·유인 (목적 무관)');
    note(ctx, '약취·유인 후 실제 성범죄가 있었다면 해당 성범죄를 따로 판정해 함께 적용합니다. 미성년자 약취·유인은 특정범죄가중법 제5조의2 가중 여부도 수사부서에서 검토합니다.');
  }

  /* ───────── 미수·예비 ───────── */
  function applyStage(ctx) {
    var st = ctx.inp.stage; if (st === 'done') return;
    var keep = [];
    ctx.out.hits.forEach(function (h) {
      var law = L[h.id];
      if (h.result || h.role === 'aux') { keep.push(h); return; }
      if (st === 'attempt') {
        if (law.att) { h.stage = 'attempt'; h.stageLaw = law.att; keep.push(h); }
        else exclude(ctx, h.id, '미수범 처벌 규정이 없습니다.');
      } else if (st === 'prep') {
        var prep = law.prep;
        if (h.id === 'hy299_p' || h.id === 'hy299_t') prep = null;
        if (prep) { h.stage = 'prep'; h.stageLaw = prep; keep.push(h); }
        else exclude(ctx, h.id, '예비·음모 처벌 규정이 없습니다' + (/298|_t$|_3$/.test(h.id) ? ' (강제추행 계열은 예비·음모 불처벌).' : '.'));
      }
    });
    ctx.out.hits = keep;
    if (st === 'attempt') note(ctx, '미수: 실행에 착수했으나 완성하지 못한 경우. 성폭력처벌법 미수는 죄명 뒤에 "미수"를 따로 붙이지 않습니다. 형은 기본범죄 기준이며 임의적 감경 대상입니다(형법 제25조).');
    if (st === 'prep') note(ctx, '예비·음모는 모두 3년 이하의 징역입니다. 범행 도구 준비, 장소 물색, 공모 등 구체적 준비행위를 확인하세요.');
  }

  /* ───────── 가중 ───────── */
  function applyAggravation(ctx) {
    var f = ctx.inp.f, vi = ctx.vi;
    ctx.out.hits.forEach(function (h) {
      if (h.role === 'aux' || h.absorbed) return;
      var id = h.id;
      if (f.facility && /^sp6_/.test(id)) h.mods.push({ law: '성폭력처벌법 제6조제7항', text: '장애인 보호·교육시설의 장·종사자가 보호·감독 대상 장애인에게 범행: 형의 1/2까지 가중', factor: 1.5 });
      if (f.reporter && vi.ac) {
        if (id === 'sp7_3') h.mods.push({ law: '아청법 제18조', text: '위헌(2023헌가15, 2026.5.21.): 성폭력처벌법 제7조제3항(13세 미만 강제추행)에는 신고의무자 가중을 적용하지 않습니다', factor: 1, blocked: true });
        else h.mods.push({ law: '아청법 제18조', text: '신고의무기관 장·종사자가 보호·감독·진료 대상 아동·청소년에게 범행: 형의 1/2까지 가중', factor: 1.5 });
      }
      if (f.habitual && /^hy(297|298|299|302|303|305)/.test(id)) h.mods.push({ law: '형법 제305조의2', text: '상습: 형의 1/2까지 가중', factor: 1.5 });
    });
    if (f.facility && !vi.disabled) note(ctx, '시설 종사자 가중(성폭력처벌법 제6조제7항)은 피해자가 장애인일 때만 적용됩니다.');
    if (f.reporter && vi.known && !vi.ac) note(ctx, '신고의무자 가중(아청법 제18조)은 피해자가 19세 미만일 때만 적용됩니다.');
  }

  /* ───────── 공소시효 안내 ───────── */
  function statuteOfLimitations(ctx) {
    var vi = ctx.vi, ids = ctx.out.hits.map(function (h) { return h.id; });
    if (!ids.length) return;
    var exemptList = /^(hy297$|hy298|hy299|hy301|hy305|sp6_|sp7_|sp8|sp9|ac7_|ac9|ac10)/;
    var murder = /^(hy301_2k|sp9_1|ac10_1)$/;
    if (ids.some(function (id) { return murder.test(id); })) { ctx.out.sol = '공소시효 없음 (강간 등 살인 — 성폭력처벌법 제21조제4항)'; return; }
    if ((vi.under13 || vi.disabled) && ids.some(function (id) { return exemptList.test(id); })) {
      ctx.out.sol = '공소시효 배제 대상일 가능성이 높음 (13세 미만·장애인 대상 강간·강제추행 등 — 성폭력처벌법 제21조제3항). 오래전 사건도 일단 접수하고, 해당 여부는 수사부서가 확인합니다.'; return;
    }
    var parts = [];
    if (vi.minorCivil) parts.push('미성년자 피해: 피해자가 성년(19세)이 된 날부터 공소시효 진행 (제21조제1항)');
    parts.push('DNA 등 과학적 증거가 있으면 강간·강제추행 등은 공소시효 10년 연장 (제21조제2항)');
    ctx.out.sol = parts.join(' / ');
  }

  /* ───────── 순위 ───────── */
  function rank(out) {
    out.hits.forEach(function (h, i) {
      var law = L[h.id];
      var p = law.p;
      if (h.stage === 'prep') p = { max: 3 };
      // 가중(1/2)은 순위에 반영하지 않는다: 동일 법정형이면 13세 미만 특별규정을 우선
      h.score = severity(p) + (/^sp7_/.test(h.id) ? 0.5 : 0) - (h.role === 'aux' ? 1e6 : 0) - (h.absorbed ? 5e5 : 0) - (h.cond ? 1 : 0);
      h.order = i;
    });
    out.hits.sort(function (a, b) { return (b.score - a.score) || (a.order - b.order); });
    var first = out.hits[0];
    if (first && first.role !== 'aux') first.primary = true;
    out.primary = first && first.primary ? first : null;
  }

  /* 체크리스트용 태그 */
  function buildTags(ctx) {
    var t = ctx.out.tags, inp = ctx.inp, vi = ctx.vi, oi = ctx.oi;
    t.contact = ['r', 'p', 't'].indexOf(inp.act) >= 0 || (inp.act === 'buying' && inp.sub !== 'lure');
    t.penetrative = inp.act === 'r' || inp.act === 'p' || (inp.act === 'buying' && inp.buyKind !== 't');
    t.drug = inp.means === 'incap';
    t.digital = inp.act === 'media' || inp.act === 'online';
    t.dist = inp.act === 'media' && inp.sub === 'dist';
    t.victim19 = vi.known && vi.age < 19;
    t.victimChild = vi.known && vi.child18;
    t.under13 = vi.under13;
    t.disabled = vi.disabled;
    t.weak = (vi.known && vi.age < 19) || vi.disabledWeak;
    t.kin = !!inp.f.kin;
    t.offMinor = oi.known && oi.age < 19;
    t.offUnder14 = oi.known && oi.age < 14;
    t.military = oi.military;
    t.injury = inp.result !== 'none';
    t.exposure = inp.act === 'exposure';
    t.crowded = !!inp.f.crowded;
    t.elderly = vi.elderly;
  }

  var api = { evaluate: evaluate, ageAt: ageAt, today: today, KIND_LABEL: KIND_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
