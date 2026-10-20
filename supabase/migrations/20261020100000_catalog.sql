-- F-03 상품 정보 DB 관리, F-05 재고 관리
-- 상품·재고 테이블과 현재 products.js 상품 시드

create table public.products (
  id           text primary key check (id ~ '^[A-Z0-9-]{2,32}$'),
  cat          text not null check (cat in ('jersey', 'windbreaker')),
  sub          text not null,
  name         text not null check (length(name) between 1 and 80),
  price        integer not null check (price > 0),
  sale         integer not null default 0 check (sale >= 0 and sale < price),
  badge        text not null default '' check (badge in ('', 'best', 'new', 'sale')),
  type         text check (type in ('track', 'anorak', 'packable', 'shell')),  -- 바람막이 일러스트 형태
  club         text,
  club_short   text,
  description  text not null default '',
  -- 축구복: [{name, body, stripe?, sleeve?, trim?, collar?, pattern?, num?}] / 바람막이: [{name, hex}]
  colors       jsonb not null check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) > 0),
  sizes        text[] not null check (cardinality(sizes) > 0),
  images       jsonb not null default '{}'::jsonb,  -- {front, back, detail} 사진 주소 (F-17)
  rating_avg   numeric(2,1) not null default 0,
  review_count integer not null default 0,
  sort         integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.product_stock (
  product_id  text not null references public.products(id) on update cascade on delete cascade,
  color_index integer not null check (color_index >= 0),
  size        text not null,
  qty         integer not null default 0 check (qty >= 0),
  updated_at  timestamptz not null default now(),
  primary key (product_id, color_index, size)
);

alter table public.products enable row level security;
alter table public.product_stock enable row level security;

create policy "판매 중인 상품은 누구나 조회" on public.products
  for select to anon, authenticated using (active);
create policy "재고는 누구나 조회" on public.product_stock
  for select to anon, authenticated using (true);

-- 시드: 기존 products.js 상품 (설명의 비공식 안내 문구는 화면에서 붙입니다)
insert into public.products (id, cat, club, club_short, sub, name, price, sale, badge, type, description, colors, sizes, sort) values
('FK-MCI','jersey','MCI','맨시티','프리미어리그','맨체스터 시티 저지',129000,0,'best',null,
 '스카이 블루 홈과 네이비 어웨이. 가벼운 흡습속건 메시 원단의 레귤러 핏.',
 '[{"name":"홈","body":"#6cabdd","trim":"#ffffff","pattern":"tonal","num":"#1c2c5b"},{"name":"어웨이","body":"#1c2c5b","trim":"#6cabdd","collar":"v","pattern":"pin"}]',
 '{S,M,L,XL,XXL}',10),
('FK-ARS','jersey','ARS','아스날','프리미어리그','아스날 저지',129000,0,'new',null,
 '레드 몸판에 화이트 소매를 매치한 홈 컬러, 옐로 어웨이.',
 '[{"name":"홈","body":"#db0007","sleeve":"#ffffff","trim":"#ffffff","num":"#ffffff"},{"name":"어웨이","body":"#f2c230","trim":"#0b1e5b","collar":"v","pattern":"tonal"}]',
 '{S,M,L,XL,XXL}',20),
('FK-LIV','jersey','LIV','리버풀','프리미어리그','리버풀 저지',129000,0,'best',null,
 '올 레드 홈과 화이트 어웨이. 통기 패널로 경기 중에도 시원합니다.',
 '[{"name":"홈","body":"#c8102e","trim":"#ffffff","pattern":"pin"},{"name":"어웨이","body":"#f4f4f0","trim":"#c8102e","collar":"v"}]',
 '{S,M,L,XL,XXL}',30),
('FK-MUN','jersey','MUN','맨유','프리미어리그','맨체스터 유나이티드 저지',129000,109000,'sale',null,
 '블랙 칼라 포인트의 레드 홈, 화이트 어웨이.',
 '[{"name":"홈","body":"#da291c","trim":"#111111","collar":"v","pattern":"tonal","num":"#ffffff"},{"name":"어웨이","body":"#f4f4f0","trim":"#da291c"}]',
 '{S,M,L,XL,XXL}',40),
('FK-CHE','jersey','CHE','첼시','프리미어리그','첼시 저지',129000,0,'',null,
 '로열 블루 홈과 화이트 어웨이. 신축성 좋은 슬림 레귤러 핏.',
 '[{"name":"홈","body":"#034694","trim":"#ffffff","pattern":"tonal"},{"name":"어웨이","body":"#f4f4f0","trim":"#034694","collar":"v","pattern":"hoop"}]',
 '{S,M,L,XL,XXL}',50),
('FK-TOT','jersey','TOT','토트넘','프리미어리그','토트넘 홋스퍼 저지',129000,99000,'sale',null,
 '네이비 트림의 화이트 홈, 네이비 어웨이.',
 '[{"name":"홈","body":"#f4f4f0","trim":"#132257","pattern":"tonal"},{"name":"어웨이","body":"#132257","trim":"#f4f4f0","collar":"v","pattern":"pin"}]',
 '{S,M,L,XL,XXL}',60),
('FK-ATM','jersey','ATM','아틀레티코','라리가','아틀레티코 마드리드 저지',129000,0,'new',null,
 '레드·화이트 세로 줄무늬 홈과 네이비 어웨이.',
 '[{"name":"홈","body":"#cb3524","stripe":"#f4f4f0","sleeve":"#cb3524","trim":"#1e2b4e","num":"#1e2b4e"},{"name":"어웨이","body":"#1e2b4e","trim":"#cb3524","collar":"v","pattern":"tonal"}]',
 '{S,M,L,XL,XXL}',70),
('FK-RMA','jersey','RMA','레알','라리가','레알 마드리드 저지',139000,0,'best',null,
 '골드 트림의 올 화이트 홈, 네이비 어웨이.',
 '[{"name":"홈","body":"#f4f4f0","trim":"#c9a227","collar":"v","pattern":"tonal","num":"#1b2a4a"},{"name":"어웨이","body":"#1b2a4a","trim":"#c9a227","pattern":"pin"}]',
 '{S,M,L,XL,XXL}',80),
('FK-FCB','jersey','FCB','바르샤','라리가','FC 바르셀로나 저지',139000,0,'best',null,
 '블루·가넷 세로 줄무늬 홈과 골드 어웨이.',
 '[{"name":"홈","body":"#a50044","stripe":"#004d98","sleeve":"#004d98","trim":"#edbb00","num":"#edbb00"},{"name":"어웨이","body":"#edbb00","trim":"#a50044","collar":"v","pattern":"tonal"}]',
 '{S,M,L,XL,XXL}',90),
('WB-001','windbreaker',null,null,'트레이닝','매치데이 트레이닝 윈드 재킷',119000,0,'best','track',
 '워밍업과 출퇴근 모두에 좋은 풀집 윈드 재킷. 메시 안감으로 땀이 차지 않습니다.',
 '[{"name":"블랙","hex":"#1d1d1f"},{"name":"네이비","hex":"#1f2a44"},{"name":"레드","hex":"#c8261d"}]',
 '{S,M,L,XL,XXL}',110),
('WB-002','windbreaker',null,null,'아노락','사이드라인 하프집 아노락',139000,109000,'sale','anorak',
 '바람을 막는 하프집 아노락. 캥거루 포켓에 접어 넣을 수 있습니다.',
 '[{"name":"블루","hex":"#2f6db5"},{"name":"올리브","hex":"#5b6142"},{"name":"볼트 옐로","hex":"#e8c21a"}]',
 '{S,M,L,XL,XXL}',120),
('WB-003','windbreaker',null,null,'경량','피치사이드 패커블 재킷',99000,0,'new','packable',
 '150g대의 초경량 바람막이. 전용 파우치에 넣어 가방에 챙기기 좋습니다.',
 '[{"name":"화이트","hex":"#efefea"},{"name":"블랙","hex":"#1d1d1f"},{"name":"포레스트","hex":"#2f5d46"}]',
 '{S,M,L,XL,XXL}',130),
('WB-004','windbreaker',null,null,'트레이닝','드릴 탑 윈드브레이커',129000,0,'','track',
 '팔 움직임이 편한 래글런 소매의 트레이닝 탑. 밑단 스트링으로 바람 차단.',
 '[{"name":"네이비","hex":"#1f2a44"},{"name":"그레이","hex":"#8b8f94"},{"name":"오렌지","hex":"#e2622b"}]',
 '{S,M,L,XL,XXL}',140),
('WB-005','windbreaker',null,null,'경량','올웨더 2L 쉘 재킷',189000,0,'best','shell',
 '가벼운 2레이어 방수 쉘. 비 오는 날 관전과 원정 응원에 추천합니다.',
 '[{"name":"볼트 옐로","hex":"#e8c21a"},{"name":"블랙","hex":"#1d1d1f"},{"name":"네이비","hex":"#1f2a44"}]',
 '{S,M,L,XL,XXL}',150),
('WB-006','windbreaker',null,null,'아노락','스톰 쉴드 오버헤드 아노락',159000,129000,'sale','anorak',
 '넉넉한 오버핏 아노락. 후드 조절 스트링과 사이드 지퍼로 입고 벗기 쉽습니다.',
 '[{"name":"레드","hex":"#c8261d"},{"name":"샌드","hex":"#cbb892"},{"name":"블랙","hex":"#1d1d1f"}]',
 '{S,M,L,XL,XXL}',160);

-- 재고 시드: 모든 옵션 20개, 기존 품절 사이즈는 0개
insert into public.product_stock (product_id, color_index, size, qty)
select p.id, c.idx - 1, s.size,
       case when (p.id = 'FK-LIV' and s.size = 'S') or (p.id = 'FK-RMA' and s.size = 'M')
                 or (p.id = 'WB-004' and s.size = 'XXL') then 0 else 20 end
from public.products p
cross join lateral jsonb_array_elements(p.colors) with ordinality as c(val, idx)
cross join lateral unnest(p.sizes) as s(size);
