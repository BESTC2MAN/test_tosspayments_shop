-- 상품 사진: Unsplash 무료 사진 핫링크 (front: 4:5 크롭, detail: 같은 사진을 2배 확대한 크롭)
-- 관리자 페이지에서 사진을 올리면 Storage 주소로 바뀝니다.
with p(id, src) as (values
  ('FK-MCI', 'photo-1612387050703-685c779375d4'),
  ('FK-ARS', 'photo-1577212017184-80cc0da11082'),
  ('FK-LIV', 'photo-1599446691418-9938936aa43b'),
  ('FK-MUN', 'photo-1772474659559-7d009fef11df'),
  ('FK-CHE', 'photo-1628813640706-ca88bcdfb228'),
  ('FK-TOT', 'photo-1739694453275-a5326bbb37ea'),
  ('FK-ATM', 'photo-1675684512606-a6333b7531fb'),
  ('FK-RMA', 'photo-1760551733698-8e4a497d40d4'),
  ('FK-FCB', 'photo-1707414038523-b5d1c8294786'),
  ('WB-001', 'photo-1643622782660-30dedcd8d75a'),
  ('WB-002', 'photo-1611308725032-74f0a551d018'),
  ('WB-003', 'photo-1655972670403-243839675e06'),
  ('WB-004', 'photo-1768983953826-231e8ef0b6dc'),
  ('WB-005', 'photo-1781735974892-360b1cbf8765'),
  ('WB-006', 'photo-1571867424485-369464ed33cc')
)
update public.products t
   set images = jsonb_build_object(
     'front',  'https://images.unsplash.com/' || p.src || '?auto=format&fit=crop&w=800&h=1000&q=75',
     'detail', 'https://images.unsplash.com/' || p.src || '?auto=format&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.45&fp-z=2&w=800&h=1000&q=75')
  from p
 where t.id = p.id;
