#!/usr/bin/env node

console.log('🎭 발표용 데모 데이터 생성 중...\n');

const axios = require('axios');

// 샘플 직원 데이터
const sampleEmployees = [
  {
    name: '김철수',
    email: 'kim.chulsoo@company.com',
    department: 'Engineering',
    role: 'Senior Developer',
    location: 'Seoul',
    timezone: 'Asia/Seoul',
    skills: [
      { name: 'JavaScript', level: 'expert' },
      { name: 'React', level: 'advanced' },
      { name: 'Node.js', level: 'expert' },
      { name: 'TypeScript', level: 'advanced' }
    ],
    availability: {
      available: true,
      capacity: 80
    },
    contactInfo: {
      phone: '010-1234-5678',
      address: '서울시 강남구'
    },
    emergencyContact: {
      name: '김영희',
      relationship: '배우자',
      phone: '010-1234-5679'
    },
    certifications: [
      {
        id: 'cert-001',
        name: 'AWS Solutions Architect',
        issuer: 'Amazon',
        issuedAt: '2024-01-15',
        verified: true
      }
    ]
  },
  {
    name: '이영희',
    email: 'lee.younghee@company.com',
    department: 'Engineering',
    role: 'DevOps Engineer',
    location: 'Seoul',
    timezone: 'Asia/Seoul',
    skills: [
      { name: 'Docker', level: 'expert' },
      { name: 'Kubernetes', level: 'advanced' },
      { name: 'AWS', level: 'expert' },
      { name: 'Python', level: 'advanced' }
    ],
    availability: {
      available: true,
      capacity: 70
    },
    contactInfo: {
      phone: '010-2345-6789',
      address: '서울시 서초구'
    },
    emergencyContact: {
      name: '이철수',
      relationship: '형제',
      phone: '010-2345-6790'
    },
    certifications: [
      {
        id: 'cert-002',
        name: 'Certified Kubernetes Administrator',
        issuer: 'CNCF',
        issuedAt: '2024-03-20',
        verified: true
      }
    ]
  },
  {
    name: '박민수',
    email: 'park.minsoo@company.com',
    department: 'Product',
    role: 'Product Manager',
    location: 'Seoul',
    timezone: 'Asia/Seoul',
    skills: [
      { name: 'Product Strategy', level: 'expert' },
      { name: 'Agile', level: 'advanced' },
      { name: 'Data Analysis', level: 'intermediate' },
      { name: 'SQL', level: 'intermediate' }
    ],
    availability: {
      available: true,
      capacity: 90
    },
    contactInfo: {
      phone: '010-3456-7890',
      address: '서울시 마포구'
    },
    emergencyContact: {
      name: '박영미',
      relationship: '부모',
      phone: '010-3456-7891'
    },
    certifications: [
      {
        id: 'cert-003',
        name: 'Certified Scrum Product Owner',
        issuer: 'Scrum Alliance',
        issuedAt: '2023-11-10',
        verified: true
      }
    ]
  }
];

async function createDemoData() {
  console.log('🔄 기존 직원 데이터 확인 중...');
  
  try {
    const existingResponse = await axios.get('http://localhost:3000/api/hr/employees', { timeout: 5000 });
    const existingCount = existingResponse.data.employees?.length || 0;
    console.log(`📊 기존 직원 수: ${existingCount}명`);
    
    if (existingCount >= 3) {
      console.log('✅ 충분한 데모 데이터가 이미 존재합니다.');
      return;
    }
  } catch (error) {
    console.log('⚠️ 기존 데이터 확인 실패, 새로 생성합니다.');
  }

  console.log('\n👥 샘플 직원 데이터 생성 중...');
  
  for (let i = 0; i < sampleEmployees.length; i++) {
    const employee = sampleEmployees[i];
    
    try {
      console.log(`🔄 ${employee.name} 생성 중...`);
      
      const response = await axios.post('http://localhost:3000/api/hr/employees', employee, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ ${employee.name} 생성 완료 (ID: ${response.data.id})`);
      
      // 각 생성 간 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ ${employee.name} 생성 실패:`, error.response?.data?.error || error.message);
    }
  }

  console.log('\n🎯 리소스 매칭 테스트...');
  
  // 샘플 리소스 요청
  const sampleRequest = {
    requesterId: 'demo-requester',
    requiredSkills: ['JavaScript', 'React'],
    priority: 'high',
    estimatedDuration: 40,
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    remote: true,
    description: '새로운 웹 애플리케이션 프론트엔드 개발'
  };

  try {
    const matchResponse = await axios.post('http://localhost:3000/api/hr/resources/match', sampleRequest, {
      timeout: 10000
    });
    
    const matches = matchResponse.data.matches || [];
    console.log(`✅ 리소스 매칭 완료: ${matches.length}명의 후보자 발견`);
    
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.employee?.name || 'Unknown'} (${match.employee?.role || 'Unknown'})`);
    });
    
  } catch (error) {
    console.log('❌ 리소스 매칭 테스트 실패:', error.response?.data?.error || error.message);
  }

  console.log('\n🎉 데모 데이터 생성 완료!');
  console.log('\n📋 발표 시나리오:');
  console.log('1. 직원 목록 조회: GET /api/hr/employees');
  console.log('2. 특정 직원 조회: GET /api/hr/employees/{id}');
  console.log('3. 스킬 기반 검색: GET /api/hr/employees?skill=JavaScript');
  console.log('4. 리소스 매칭: POST /api/hr/resources/match');
  console.log('5. 팀 워크로드: GET /api/hr/workload/team/Engineering');
  
  console.log('\n🔗 테스트 URL:');
  console.log('• http://localhost:3000/api/hr/employees');
  console.log('• http://localhost:3000/api/hr/employees?department=Engineering');
  console.log('• http://localhost:3000/api/hr/analytics/skills');
}

createDemoData().catch(console.error);
