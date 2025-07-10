-- 초기 테스트 데이터 시드

-- 테스트 사용자들 생성
INSERT INTO users (employee_id, name, email, department, role) VALUES
  ('EMP001', '김철수', 'kim.cs@company.com', '개발팀', 'employee'),
  ('EMP002', '이영희', 'lee.yh@company.com', '기획팀', 'employee'),
  ('EMP003', '박민수', 'park.ms@company.com', '디자인팀', 'employee'),
  ('ADMIN001', '관리자', 'admin@company.com', '신사업추진팀', 'admin')
ON CONFLICT (employee_id) DO NOTHING;

-- 회의실 생성
INSERT INTO rooms (name, description, capacity, location, amenities) VALUES
  ('회의실 A', '대형 회의실', 10, '1층', '{"projector": true, "whiteboard": true, "wifi": true, "tv": true}'),
  ('회의실 B', '소형 회의실', 4, '2층', '{"whiteboard": true, "wifi": true}'),
  ('회의실 C', '화상회의실', 6, '3층', '{"camera": true, "microphone": true, "wifi": true, "tv": true}')
ON CONFLICT (name) DO NOTHING; 