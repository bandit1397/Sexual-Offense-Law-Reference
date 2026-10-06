/*
 * 현장 조치 체크리스트
 * - 판정 결과의 tags 에 따라 필요한 항목만 골라 보여준다.
 * - when: tags 를 받아 true/false. 생략하면 항상 표시.
 * - 연락처는 확인된 전국 대표번호만 넣는다. 관할 기관 번호는 지역별로 추가할 것.
 */
(function (root) {
  'use strict';

  var SECTIONS = [
    {
      id: 'safety', title: '① 즉시 — 안전·분리',
      items: [
        { t: '피해자 신변 안전 확보. 가해자와 시야·동선이 겹치지 않게 분리', key: true },
        { t: '부상·출혈·의식저하·약물 의심 시 즉시 119 요청, 병원 이송 우선', when: function (g) { return g.contact || g.injury || g.drug; } },
        { t: '현행범이면 체포 검토 (형사소송법 제212조). 체포 시 범죄사실 요지·체포 이유·변호인 선임권 등 고지' },
        { t: '체포 현장에서 영장 없이 압수 가능 (제216조제1항제2호). 계속 압수하려면 지체 없이 영장 신청 — 검사 청구는 체포 후 48시간 이내 (제217조제2항)', key: true },
        { t: '가해자가 친족·동거인이면 피해자를 가해자와 같은 집으로 돌려보내지 않음. 귀가 장소 안전 여부 확인', when: function (g) { return g.kin; }, key: true },
        { t: '18세 미만 피해자이고 가해자가 보호자·가족이면 아동학대 응급조치(분리·보호시설 인도) 검토. 가해 보호자에게 인계 금지', when: function (g) { return g.victimChild && g.kin; }, key: true },
        { t: '피해자가 원하면 신뢰하는 사람(보호자 등)에게 연락. 단, 그 사람이 가해자이거나 피해자에게 불리하면 제외', when: function (g) { return g.weak; } }
      ]
    },
    {
      id: 'evidence', title: '② 증거 보전',
      items: [
        { t: '씻기·양치·소변·옷 갈아입기를 미루도록 정중히 안내 (불가피하면 이유 기록)', when: function (g) { return g.contact; }, key: true },
        { t: '입었던 옷·속옷은 종이봉투에 한 점씩 따로 포장 (비닐 X, 젖은 것은 말리거나 즉시 인계)', when: function (g) { return g.contact; } },
        { t: '해바라기센터 등 지정 의료기관에서 성폭력 응급키트로 증거 채취 (가능한 빨리, 통상 72시간 이내 권장). 응급피임·성병 예방 안내', when: function (g) { return g.penetrative; } },
        { t: '약물·음주 의심: 소변·혈액을 최대한 빨리 채취 (시간이 지나면 검출 안 됨). 마신 잔·병 확보', when: function (g) { return g.drug; }, key: true },
        { t: '현장 보존: 침구·휴지·콘돔·담배꽁초 등 손대지 말고 사진 촬영 후 과학수사 요청', when: function (g) { return g.contact; } },
        { t: '주변 CCTV·블랙박스 위치 파악하고 보존 요청 (보존기간이 짧음)', key: true },
        { t: '대중교통이면 호선·열차번호·칸·시각·하차역 기록, 역 CCTV 확보 요청', when: function (g) { return g.crowded; } },
        { t: '피해자 휴대전화의 메시지·통화기록·사진은 삭제하지 말고 화면 캡처 + 원본 보존 안내', when: function (g) { return g.digital || g.contact; } },
        { t: '가해자 기기 확보: 현행범 체포 현장 압수 또는 임의제출. 전원·비행기모드 처리로 원격 삭제 방지, 클라우드·메신저 계정 확인', when: function (g) { return g.digital; } },
        { t: '유포 URL·게시물·계정 정보를 캡처해 기록. 유포 확인 시 삭제·접속차단 요청 절차 진행 (성폭력처벌법 제23조의2)', when: function (g) { return g.dist; } },
        { t: '상해 사진 촬영(피해자 동의), 진단서 발급 안내', when: function (g) { return g.injury || g.contact; } }
      ]
    },
    {
      id: 'victim', title: '③ 피해자 보호·진술',
      items: [
        { t: '현장에서는 초동 필요사항(누가·언제·어디서·무엇을·가해자 인상착의·도주방향)만 짧게 확인. 상세 진술은 성폭력 전담 조사관이 받음 (성폭력처벌법 제26조·제29조: 조사 횟수 최소화)' },
        { t: '피해 사실을 의심하거나 책임을 묻는 말 금지 ("왜 따라갔어요?", "왜 저항 안 했어요?" 등)' },
        { t: '19세 미만·장애로 의사결정능력이 미약한 피해자 = "19세미만피해자등": 현장에서 반복 질문 금지. 진술은 전담 조사관이 영상녹화로 받음 (제30조, 피해자·법정대리인이 원하지 않으면 녹화하지 않음)', when: function (g) { return g.weak; }, key: true },
        { t: '조사 전에 진술조력인을 신청할 수 있음을 고지 (제36조)', when: function (g) { return g.weak; } },
        { t: '조사 시 신뢰관계인 동석 (제34조제2항, 피해자에게 불리하거나 원하지 않으면 제외)', when: function (g) { return g.weak || g.disabled; } },
        { t: '19세미만피해자등은 국선변호사 선정 의무 (제27조제6항). 그 밖의 피해자도 피해자 국선변호사 제도 안내', when: function (g) { return g.weak; } },
        { t: '가해자와 마주치지 않도록 조사 동선·대기장소 분리 (제29조제3항)', when: function (g) { return g.weak; } },
        { t: '장애 유형에 맞춘 의사소통 (수어통역, 쉬운 말, 보조기기). 장애인권익옹호기관 연계 검토', when: function (g) { return g.disabled; } },
        { t: '피해자 성명·주소·학교 등 신원 비밀 엄수. 무전·보고서·외부 연락 시 노출 주의 (제24조)', key: true }
      ]
    },
    {
      id: 'handover', title: '④ 인계·보고',
      items: [
        { t: '여성청소년수사팀(성폭력 전담)에 즉시 보고·인계. 이 화면의 "보고용 요약 복사"를 활용' },
        { t: '13세 미만·장애인 피해: 사건 중대성 높음, 상급 보고 및 해바라기센터 연계', when: function (g) { return g.under13 || g.disabled; } },
        { t: '가해자 14세 미만: 형사처벌 불가 → 사건 기록 후 소년부 송치(촉법소년) 절차. 10세 미만은 처분 불가', when: function (g) { return g.offUnder14; } },
        { t: '가해자 19세 미만: 보호자 연락. 피해자와 같은 학교면 학교폭력 신고 절차도 별도 진행', when: function (g) { return g.offMinor; } },
        { t: '가해자 군인: 경찰이 수사(평시 성범죄는 일반 법원 관할). 소속 부대에 통보', when: function (g) { return g.military; } },
        { t: '아동 대상이면 아동학대 신고 여부 확인, 아동보호전문기관 연계', when: function (g) { return g.victimChild; } },
        { t: '65세 이상이면 노인보호전문기관 연계 검토', when: function (g) { return g.elderly; } }
      ]
    },
    {
      id: 'info', title: '⑤ 피해자 안내',
      items: [
        { t: '성범죄는 고소가 없어도 수사함 (친고죄 폐지). 합의해도 사건이 끝나지 않음', key: true },
        { t: '여성긴급전화 1366 (24시간 상담·보호시설 연계)' },
        { t: '해바라기센터: 24시간 의료·상담·수사·법률 지원 (관할 센터 번호를 미리 확인해 둘 것)' },
        { t: '디지털성범죄피해자지원센터 02-735-8994: 불법촬영물·딥페이크 삭제 지원', when: function (g) { return g.digital; } },
        { t: '장애인권익옹호기관 1644-8295', when: function (g) { return g.disabled; } },
        { t: '범죄피해자 지원(치료비·생계비 등), 피해자 국선변호사 제도 안내' }
      ]
    }
  ];

  function build(tags) {
    return SECTIONS.map(function (s) {
      return {
        id: s.id, title: s.title,
        items: s.items.filter(function (it) { return !it.when || it.when(tags || {}); }).map(function (it) { return { t: it.t, key: !!it.key }; })
      };
    }).filter(function (s) { return s.items.length; });
  }

  var api = { SECTIONS: SECTIONS, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Checklist = api;
})(this);
