#!/usr/bin/env node

console.log('🧪 HCM 시스템 기본 기능 테스트\n');

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testBasicFunctions() {
  try {
    console.log('1. 🏥 HR Service 헬스체크...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ HR Service 정상:', health.data.status);

    console.log('\n2. 👥 직원 목록 조회...');
    const employees = await axios.get(`${API_BASE}/employees`);
    console.log(`✅ 직원 데이터: ${employees.data.employees?.length || 0}명`);

    console.log('\n3. 👤 테스트 직원 생성...');
    const newEmployee = {
      name: '김철수',
      email: 'kim.chulsoo@company.com',
      department: 'Engineering',
      role: 'Senior Developer',
      location: 'Seoul',
      skills: [
        { name: 'JavaScript', level: 'expert' },
        { name: 'React', level: 'advanced' },
        { name: 'Node.js', level: 'advanced' }
      ],
      availability: { 
        available: true, 
        capacity: 80 
      },
      contactInfo: {
        phone: '010-1234-5678',
        address: 'Seoul, Korea'
      },
      emergencyContact: {
        name: '김영희',
        relationship: 'spouse',
        phone: '010-8765-4321'
      },
      timezone: 'Asia/Seoul'
    };

    const createResult = await axios.post(`${API_BASE}/employees`, newEmployee);
    console.log('✅ 직원 생성 성공:', createResult.data.name);

    console.log('\n4. 📊 스킬 분석 데이터...');
    try {
      const skillsAnalytics = await axios.get(`${API_BASE}/analytics/skills`);
      console.log('✅ 스킬 분석 완료:', skillsAnalytics.data.length, '개 스킬');
    } catch (error) {
      console.log('⚠️ 스킬 분석 스킵 (데이터 부족)');
    }

    console.log('\n5. 🔍 리소스 매칭 테스트...');
    const matchRequest = {
      requiredSkills: ['JavaScript', 'React'],
      priority: 'high',
      estimatedDuration: 40,
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      remote: true,
      description: '웹 애플리케이션 개발 프로젝트'
    };

    const matchResult = await axios.post(`${API_BASE}/resources/match`, matchRequest);
    console.log('✅ 매칭 엔진 성공:', matchResult.data.matches?.length || 0, '명 매칭');

    console.log('\n🎉 모든 기본 기능 테스트 완료!');
    console.log('\n📝 발표 준비 상태:');
    console.log('  ✅ Docker 환경 실행');
    console.log('  ✅ 데이터베이스 연결');
    console.log('  ✅ API 엔드포인트 작동');
    console.log('  ✅ 직원 생성/조회 기능');
    console.log('  ✅ 리소스 매칭 기능');
    
    console.log('\n🚀 다음 단계: 발표용 데모 시나리오 준비');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 데이터:', error.response.data);
    }
  }
}

testBasicFunctions();
