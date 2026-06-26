import type { AlertStatus, PhaseKey, PropertyType, TransactionType } from './domain';

export type GuideTier = 'simple' | 'detailed';

export type GuideSource = {
  label: string;
  title: string;
  url?: string;
  sourceType: 'official' | 'internal';
};

export type GuideEntry = {
  checklistId: string;
  phaseKey: PhaseKey;
  itemKind: Exclude<AlertStatus, 'pending' | 'done'> | 'actionable';
  tier: GuideTier;
  appTitle: string;
  brokerTitle: string;
  sourceLabels: string[];
  summary: string;
  bullets: string[];
  warning?: string;
  done: string;
  transactionBranches?: Partial<Record<TransactionType, string[]>>;
  propertyBranches?: Partial<Record<PropertyType, string[]>>;
};

export const TRANSACTION_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'sale', label: '매매' },
  { value: 'jeonse', label: '전세' },
  { value: 'monthly_rent', label: '월세' },
  { value: 'unknown', label: '미정' },
];

export const PROPERTY_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: '아파트' },
  { value: 'villa_multi', label: '빌라/다세대' },
  { value: 'detached_multi', label: '단독/다가구' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'unknown', label: '기타/미정' },
];

export const GUIDE_SOURCES: Record<string, GuideSource> = {
  국가법령정보센터: {
    label: '국가법령정보센터',
    title: '공인중개사법 시행규칙, 확인ㆍ설명서 서식',
    url: 'https://www.law.go.kr/LSW//lsLinkCommonInfo.do?chrClsCd=&lspttninfSeq=106524',
    sourceType: 'official',
  },
  공인중개사법: {
    label: '공인중개사법',
    title: '거래계약서 작성ㆍ교부ㆍ보존 근거',
    url: 'https://www.law.go.kr/lsInfoP.do?lsiSeq=203208',
    sourceType: 'official',
  },
  '공인중개사법 시행령': {
    label: '공인중개사법 시행령',
    title: '거래계약서 기재사항, 보존기간, 확인ㆍ설명사항',
    url: 'https://www.law.go.kr/LSW/LsiJoLinkP.do?docType=JO&joNo=002200000&languageType=KO&lsNm=%EA%B3%B5%EC%9D%B8%EC%A4%91%EA%B0%9C%EC%82%AC%EB%B2%95+%EC%8B%9C%ED%96%89%EB%A0%B9&paras=1',
    sourceType: 'official',
  },
  '확인설명서 서식': {
    label: '확인설명서 서식',
    title: '주거용 건축물 확인ㆍ설명서 근거자료 항목',
    url: 'https://law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=900140903',
    sourceType: 'official',
  },
  국토교통부: {
    label: '국토교통부',
    title: '거래 제도와 확인ㆍ설명 의무 참고',
    url: 'https://www.molit.go.kr/',
    sourceType: 'official',
  },
  인터넷등기소: {
    label: '인터넷등기소',
    title: '등기사항증명서 열람ㆍ발급',
    url: 'https://www.iros.go.kr/',
    sourceType: 'official',
  },
  '정부24 건축물대장': {
    label: '정부24 건축물대장',
    title: '건축물대장 열람ㆍ발급',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098',
    sourceType: 'official',
  },
  '정부24 등기 안내': {
    label: '정부24 등기 안내',
    title: '건물 등기사항증명서 발급 안내',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=97400000003',
    sourceType: 'official',
  },
  '정부24 토지대장': {
    label: '정부24 토지대장',
    title: '토지ㆍ임야대장 열람ㆍ발급',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000026',
    sourceType: 'official',
  },
  '정부24 전입세대': {
    label: '정부24 전입세대',
    title: '전입세대확인서 열람ㆍ발급',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000305',
    sourceType: 'official',
  },
  '정부24 국세증명': {
    label: '정부24 국세증명',
    title: '국세 납세증명서',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000011',
    sourceType: 'official',
  },
  '정부24 지방세증명': {
    label: '정부24 지방세증명',
    title: '지방세 납세증명서',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000056',
    sourceType: 'official',
  },
  토지이음: {
    label: '토지이음',
    title: '토지이용계획, 지역ㆍ지구ㆍ행위제한 참고',
    url: 'https://www.eum.go.kr/web/ar/lu/luLandDet.jsp',
    sourceType: 'official',
  },
  실거래가공개: {
    label: '실거래가 공개',
    title: '실거래가 조회 참고',
    url: 'https://rt.molit.go.kr/',
    sourceType: 'official',
  },
  부동산거래관리: {
    label: '부동산거래관리',
    title: '매매 신고, 주택 임대차계약 신고',
    url: 'https://rtms.molit.go.kr/',
    sourceType: 'official',
  },
  '정부24 임대차신고': {
    label: '정부24 임대차신고',
    title: '주택 임대차 신고 민원 안내',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=16130000132',
    sourceType: 'official',
  },
  '정부24 전입신고': {
    label: '정부24 전입신고',
    title: '전입신고 민원 안내',
    url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000016',
    sourceType: 'official',
  },
  위택스: {
    label: '위택스',
    title: '지방세ㆍ취득세 납부 참고',
    url: 'https://www.wetax.go.kr/main.do',
    sourceType: 'official',
  },
  '실무 메모': {
    label: '실무 메모',
    title: '중개 실무 기록용 내부 체크',
    sourceType: 'internal',
  },
};

const transactionBranches: Partial<Record<TransactionType, string[]>> = {
  sale: [
    '매매는 이전등기ㆍ취득세ㆍ실거래신고 일정을 분리해 안내합니다.',
    '법무사 진행 건이면 접수ㆍ말소ㆍ영수증 확인 지점을 기록합니다.',
  ],
  jeonse: [
    '전세는 전입세대ㆍ확정일자ㆍ선순위 보증금 확인 흐름을 둡니다.',
    '전세대출ㆍ보증보험은 당사자와 금융기관 확인사항으로 표시합니다.',
  ],
  monthly_rent: [
    '월세는 보증금ㆍ월차임ㆍ관리비 항목 구분을 확인합니다.',
    '자동이체ㆍ공과금ㆍ임대차신고 안내 일정을 기록합니다.',
  ],
};

const propertyBranches: Partial<Record<PropertyType, string[]>> = {
  apartment: [
    '아파트는 관리사무소에서 관리비ㆍ장기수선충당금ㆍ주차를 확인합니다.',
    '층간소음ㆍ누수ㆍ입주규정 등 안내 포인트를 기록합니다.',
  ],
  villa_multi: [
    '빌라/다세대는 건축물대장 위반건축물 여부와 실제 구조를 대조합니다.',
    '주차ㆍ누수ㆍ공용관리 주체를 현장에서 확인합니다.',
  ],
  detached_multi: [
    '단독/다가구는 토지와 건물 등기, 경계, 계량기 분리 상태를 봅니다.',
    '다가구 임대차는 전입세대ㆍ선순위 보증금 확인 가능성을 안내합니다.',
  ],
  officetel: [
    '오피스텔은 주거용 사용, 전입 가능성, 관리규약, 관리비 구조를 확인합니다.',
    '매매라면 취득세ㆍ부가세 등 비용은 전문가 확인으로 남깁니다.',
  ],
};

export const GUIDE_ENTRIES: Record<string, GuideEntry> = {
  pre_docs: {
    checklistId: 'pre_docs',
    phaseKey: 'pre_contract',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '계약 전 서류 확인',
    brokerTitle: '계약 전 근거자료 확인',
    sourceLabels: ['확인설명서 서식', '인터넷등기소', '정부24 건축물대장', '정부24 토지대장', '토지이음', '정부24 국세증명', '정부24 지방세증명'],
    summary: '계약 전 공적 장부와 제출자료를 대조해 설명 근거를 정리합니다.',
    bullets: [
      '등기사항증명서 갑구ㆍ을구를 최신본으로 확인합니다.',
      '건축물대장ㆍ토지대장ㆍ토지이용계획을 대조합니다.',
      '임대차라면 전입세대ㆍ확정일자ㆍ납세자료 확인 가능성을 안내합니다.',
    ],
    warning: '신탁ㆍ가압류ㆍ위반건축물 표시는 전문가 확인 전 단정하지 않습니다.',
    done: '확인한 근거자료와 미확인 사유를 메모했습니다.',
    transactionBranches,
    propertyBranches,
  },
  pre_owner: {
    checklistId: 'pre_owner',
    phaseKey: 'pre_contract',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '소유자 정보 확인',
    brokerTitle: '등기상 소유자ㆍ대리 여부 확인',
    sourceLabels: ['인터넷등기소', '정부24 등기 안내', '확인설명서 서식'],
    summary: '계약 상대가 등기상 소유자 또는 적법한 대리인인지 확인합니다.',
    bullets: [
      '등기상 소유자명과 신분증 정보를 대조합니다.',
      '공동소유라면 동의ㆍ위임 범위를 확인합니다.',
      '대리 계약이면 위임장ㆍ인감ㆍ신분 확인 자료를 정리합니다.',
    ],
    warning: '제3자 계좌 입금 요청은 사유와 위임관계를 다시 확인합니다.',
    done: '소유자ㆍ대리관계 확인자료와 설명 메모를 남겼습니다.',
    transactionBranches,
  },
  pre_walkthrough: {
    checklistId: 'pre_walkthrough',
    phaseKey: 'pre_contract',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '현장 안내 사항 점검',
    brokerTitle: '현장 상태ㆍ안내 포인트 확인',
    sourceLabels: ['확인설명서 서식'],
    summary: '장부에 나오지 않는 현장 상태와 안내 포인트를 기록합니다.',
    bullets: [
      '누수ㆍ결로ㆍ균열ㆍ수압ㆍ전기ㆍ가스 상태를 봅니다.',
      '옵션ㆍ하자ㆍ수리 책임을 사진과 메모로 남깁니다.',
      '입지ㆍ소음ㆍ주차ㆍ관리 방식 안내 포인트를 정리합니다.',
    ],
    warning: '현장 하자는 추정하지 말고 사진ㆍ당사자 확인으로 기록합니다.',
    done: '안내한 현장 포인트와 남은 확인사항을 기록했습니다.',
    transactionBranches,
    propertyBranches,
  },
  contract_confirm: {
    checklistId: 'contract_confirm',
    phaseKey: 'contract_day',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '계약 조건 재확인',
    brokerTitle: '계약 조건ㆍ특약 재확인',
    sourceLabels: ['공인중개사법 시행령', '확인설명서 서식', '부동산거래관리'],
    summary: '금액ㆍ날짜ㆍ특약이 합의 내용과 같은지 계약 전 재확인합니다.',
    bullets: [
      '거래금액ㆍ계약금ㆍ잔금일ㆍ인도일을 다시 읽습니다.',
      '수리ㆍ대출ㆍ말소ㆍ신고 협조 특약을 확인합니다.',
      '중개대상물 확인ㆍ설명서 교부 일자를 맞춥니다.',
    ],
    warning: '효력 판단이나 특약 적법성 단정은 전문가 확인이 필요합니다.',
    done: '금액ㆍ일정ㆍ특약 확인 결과를 당사자에게 공유했습니다.',
    transactionBranches,
  },
  contract_copy: {
    checklistId: 'contract_copy',
    phaseKey: 'contract_day',
    itemKind: 'actionable',
    tier: 'simple',
    appTitle: '계약서 사본 확보',
    brokerTitle: '계약서 사본 전달ㆍ보관 확인',
    sourceLabels: ['공인중개사법 시행령'],
    summary: '서명 완료본을 당사자에게 전달하고 보관본을 정리합니다.',
    bullets: [
      '계약서ㆍ확인설명서 서명ㆍ날인 누락을 확인합니다.',
      '교부본과 보관본을 분리해 저장합니다.',
    ],
    warning: '사본 보관 시 주민번호 등 개인정보 노출을 줄입니다.',
    done: '전달 여부와 보관 위치를 메모했습니다.',
  },
  contract_signature: {
    checklistId: 'contract_signature',
    phaseKey: 'contract_day',
    itemKind: 'actionable',
    tier: 'simple',
    appTitle: '서명 일정 맞추기',
    brokerTitle: '당사자 서명 일정 조율',
    sourceLabels: ['공인중개사법 시행령'],
    summary: '당사자 서명 시간ㆍ장소ㆍ준비물을 미리 조율합니다.',
    bullets: [
      '신분증ㆍ도장ㆍ계좌ㆍ위임서류 준비를 안내합니다.',
      '공동중개라면 참석자와 서명 순서를 맞춥니다.',
    ],
    warning: '본인확인 자료가 부족하면 서명 진행을 서두르지 않습니다.',
    done: '일정ㆍ장소ㆍ준비물 안내 기록을 남겼습니다.',
  },
  deposit_transfer: {
    checklistId: 'deposit_transfer',
    phaseKey: 'deposit_prep',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '잔금 이체 준비',
    brokerTitle: '잔금 이체 준비 공유ㆍ확인',
    sourceLabels: ['인터넷등기소', '부동산거래관리'],
    summary: '잔금 흐름과 이체 준비 상태를 당사자와 공유합니다.',
    bullets: [
      '잔금 계좌가 소유자 또는 합의된 수령인인지 확인합니다.',
      '대출 실행ㆍ법무사 일정이 있으면 시간표에 넣습니다.',
      '이체한도ㆍOTPㆍ은행 방문 필요 여부를 사전 안내합니다.',
    ],
    warning: '계좌 변경 요청은 근거와 당사자 확인을 다시 받습니다.',
    done: '계좌ㆍ이체 준비ㆍ대출 일정 확인 메모를 남겼습니다.',
    transactionBranches,
  },
  deposit_receipt: {
    checklistId: 'deposit_receipt',
    phaseKey: 'deposit_prep',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '입금 확인 자료 정리',
    brokerTitle: '입금 증빙 자료 정리',
    sourceLabels: ['부동산거래관리'],
    summary: '송금과 수령 확인자료를 거래 기록으로 정리합니다.',
    bullets: [
      '이체확인증의 금액ㆍ예금주ㆍ일시를 확인합니다.',
      '수령 확인은 구두만 두지 말고 자료로 남깁니다.',
      '공동소유ㆍ대리수령이면 합의 근거를 같이 보관합니다.',
    ],
    warning: '입금 전 영수 확인 문구를 먼저 남기지 않습니다.',
    done: '입금 증빙과 수령 확인 근거를 정리했습니다.',
    transactionBranches,
  },
  deposit_schedule: {
    checklistId: 'deposit_schedule',
    phaseKey: 'deposit_prep',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '이체 시간표 확인',
    brokerTitle: '잔금일 이체 일정 조율',
    sourceLabels: ['부동산거래관리'],
    summary: '대출ㆍ이사ㆍ등기ㆍ관리정산 시간을 한 흐름으로 맞춥니다.',
    bullets: [
      '잔금일이 휴일ㆍ은행 마감과 겹치는지 확인합니다.',
      '대출 실행ㆍ법무사ㆍ이사 도착 시간을 맞춥니다.',
      '관리비ㆍ열쇠ㆍ비밀번호 인계 시점을 정리합니다.',
    ],
    warning: '지연 가능성이 있으면 비상 연락 순서를 미리 둡니다.',
    done: '잔금일 시간표와 연락 순서를 공유했습니다.',
    transactionBranches,
  },
  deposit_ref_docs: {
    checklistId: 'deposit_ref_docs',
    phaseKey: 'deposit_day_reference',
    itemKind: 'reference',
    tier: 'detailed',
    appTitle: '등기/세금 참고자료',
    brokerTitle: '잔금일 등기ㆍ비용 참고',
    sourceLabels: ['인터넷등기소', '위택스', '확인설명서 서식'],
    summary: '잔금일 다시 볼 등기ㆍ세금ㆍ중개보수 참고자료입니다.',
    bullets: [
      '최종 등기사항증명서 재확인 시점을 표시합니다.',
      '취득세ㆍ채권ㆍ중개보수는 계산하지 않고 확인처를 둡니다.',
      '법무사 견적ㆍ영수증ㆍ납부 안내 자료를 모읍니다.',
    ],
    warning: '비용ㆍ세율 계산은 앱에서 판단하지 않습니다.',
    done: '참고자료 위치와 확인처를 메모했습니다.',
    transactionBranches,
    propertyBranches,
  },
  deposit_ref_parties: {
    checklistId: 'deposit_ref_parties',
    phaseKey: 'deposit_day_reference',
    itemKind: 'reference',
    tier: 'simple',
    appTitle: '당사자 연락 참고',
    brokerTitle: '거래 당사자ㆍ실무 연락처 참고',
    sourceLabels: ['확인설명서 서식'],
    summary: '잔금일 연락이 필요한 사람과 기관을 한곳에 둡니다.',
    bullets: [
      '매도ㆍ매수 또는 임대ㆍ임차 연락처를 확인합니다.',
      '법무사ㆍ대출담당ㆍ관리사무소 연락처를 정리합니다.',
    ],
    warning: '개인정보는 필요한 범위만 기록하고 외부 공유하지 않습니다.',
    done: '연락처 그룹과 비상 연락 순서를 정리했습니다.',
  },
  deposit_ref_final: {
    checklistId: 'deposit_ref_final',
    phaseKey: 'deposit_day_reference',
    itemKind: 'reference',
    tier: 'detailed',
    appTitle: '최종 확인 항목',
    brokerTitle: '잔금 직전 최종 참고',
    sourceLabels: ['인터넷등기소', '확인설명서 서식'],
    summary: '송금 직전 권리변동ㆍ말소ㆍ인계 상태를 다시 보는 참고입니다.',
    bullets: [
      '계약 후 새 권리변동이 있는지 최신 등기를 봅니다.',
      '말소 조건이 있으면 상환ㆍ말소 진행 근거를 확인합니다.',
      '열쇠ㆍ카드키ㆍ비밀번호ㆍ공실 상태를 기록합니다.',
    ],
    warning: '새 압류ㆍ가처분ㆍ신탁 이슈는 전문가 확인 전 단정하지 않습니다.',
    done: '최종 참고사항과 미확인 리스크를 메모했습니다.',
    transactionBranches,
    propertyBranches,
  },
  deposit_ref_after: {
    checklistId: 'deposit_ref_after',
    phaseKey: 'deposit_day_reference',
    itemKind: 'reference',
    tier: 'detailed',
    appTitle: '잔금 후 참고',
    brokerTitle: '잔금 후 후속 일정 참고',
    sourceLabels: ['정부24 전입신고', '정부24 임대차신고', '부동산거래관리'],
    summary: '잔금 뒤 당사자가 챙길 신고ㆍ등기 일정을 참고로 안내합니다.',
    bullets: [
      '매매는 이전등기ㆍ취득세 일정 확인처를 안내합니다.',
      '임대차는 전입신고ㆍ확정일자ㆍ임대차신고 일정을 안내합니다.',
      '안내 여부와 당사자 질문을 메모합니다.',
    ],
    warning: '브로커가 신고를 완료한 것으로 보이게 쓰지 않습니다.',
    done: '후속 일정 안내와 질문ㆍ답변 메모를 남겼습니다.',
    transactionBranches,
    propertyBranches,
  },
  post_archive: {
    checklistId: 'post_archive',
    phaseKey: 'post_contract',
    itemKind: 'actionable',
    tier: 'simple',
    appTitle: '문서 보관',
    brokerTitle: '거래 문서 보관',
    sourceLabels: ['공인중개사법', '공인중개사법 시행령'],
    summary: '계약서와 확인ㆍ설명서 보관 상태를 정리합니다.',
    bullets: [
      '거래계약서 보관 기간은 시행령 기준을 확인합니다.',
      '확인ㆍ설명서와 근거자료를 거래별 폴더에 보관합니다.',
    ],
    warning: '스캔본에도 개인정보 접근 권한을 제한합니다.',
    done: '종이ㆍ전자 보관 위치와 기간을 기록했습니다.',
  },
  post_followup: {
    checklistId: 'post_followup',
    phaseKey: 'post_contract',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '사후 연락',
    brokerTitle: '사후 연락ㆍ피드백 확인',
    sourceLabels: ['실무 메모'],
    summary: '잔금 뒤 당사자 불편과 미해결 사항을 가볍게 확인합니다.',
    bullets: [
      '이사ㆍ인계ㆍ공과금 정산 상태를 확인합니다.',
      '하자나 연락 요청이 있으면 메모로 남깁니다.',
      '거래 경험 피드백을 다음 업무 개선에 기록합니다.',
    ],
    warning: '분쟁 판단은 하지 말고 사실과 요청만 정리합니다.',
    done: '연락 결과와 남은 요청을 기록했습니다.',
    transactionBranches,
  },
  post_utility: {
    checklistId: 'post_utility',
    phaseKey: 'post_contract',
    itemKind: 'actionable',
    tier: 'detailed',
    appTitle: '후속 처리 정리',
    brokerTitle: '잔금 후 정산ㆍ후속 일정 추적',
    sourceLabels: ['정부24 전입신고', '정부24 임대차신고', '위택스'],
    summary: '공과금ㆍ관리비ㆍ신고 일정 등 남은 후속 처리를 추적합니다.',
    bullets: [
      '전기ㆍ수도ㆍ가스 정산 확인 여부를 기록합니다.',
      '관리비ㆍ장기수선충당금 정산 여부를 확인합니다.',
      '임대차 신고ㆍ전입신고 등 안내 일정을 메모합니다.',
    ],
    warning: '당사자 의무를 앱이 완료한 것으로 보이게 표현하지 않습니다.',
    done: '정산ㆍ신고 안내 상태와 남은 일을 기록했습니다.',
    transactionBranches,
    propertyBranches,
  },
};

export const resolveGuide = (alertId: string): GuideEntry => {
  const entry = GUIDE_ENTRIES[alertId];
  if (!entry) throw new Error(`Missing ZipCheck guide entry: ${alertId}`);
  return entry;
};

export const resolveGuideSources = (entry: GuideEntry) => entry.sourceLabels.map((label) => GUIDE_SOURCES[label]).filter(Boolean);

export const resolveGuideBranches = (
  entry: GuideEntry,
  transactionType: TransactionType,
  propertyType: PropertyType,
) => ({
  transaction: entry.transactionBranches?.[transactionType] ?? [],
  property: entry.propertyBranches?.[propertyType] ?? [],
});

export const guideTierLabel = (entry: GuideEntry) => (entry.tier === 'simple' ? '확인 가이드' : '상세 가이드');

export const transactionLabel = (value: TransactionType) => TRANSACTION_OPTIONS.find((option) => option.value === value)?.label ?? '미정';

export const propertyLabel = (value: PropertyType) => PROPERTY_OPTIONS.find((option) => option.value === value)?.label ?? '기타/미정';
