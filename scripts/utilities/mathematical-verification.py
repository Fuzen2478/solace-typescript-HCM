#!/usr/bin/env python3
"""
HCM 시스템 매칭 알고리즘 수학적 검증 및 시뮬레이션
Mathematical Verification and Simulation for HCM Matching Algorithm
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.metrics import mean_squared_error, accuracy_score
from dataclasses import dataclass
from typing import List, Dict, Tuple
import random
import json
from datetime import datetime, timedelta

# 한글 폰트 설정
plt.rcParams['font.family'] = ['Malgun Gothic', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

@dataclass
class Employee:
    id: str
    name: str
    skills: Dict[str, float]  # skill_name: proficiency (0-10)
    experience_years: float
    department: str
    availability: float  # 0-1
    workload: float  # current workload 0-1

@dataclass
class Task:
    id: str
    title: str
    required_skills: Dict[str, float]  # skill_name: required_level (0-10)
    estimated_hours: float
    priority: int  # 1-10
    deadline_days: int
    complexity: float  # 0-1

@dataclass
class MatchResult:
    employee_id: str
    task_id: str
    match_score: float
    confidence: float
    reasoning: Dict[str, float]

class HCMMatchingSimulator:
    """HCM 시스템 매칭 알고리즘 시뮬레이터"""
    
    def __init__(self):
        self.employees: List[Employee] = []
        self.tasks: List[Task] = []
        self.match_results: List[MatchResult] = []
        
    def generate_sample_data(self, num_employees: int = 100, num_tasks: int = 50):
        """샘플 데이터 생성"""
        # 기술 목록
        skills = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 
                 'Machine Learning', 'DevOps', 'UI/UX', 'Project Management']
        
        departments = ['Development', 'QA', 'DevOps', 'Design', 'Management']
        
        # 직원 데이터 생성
        for i in range(num_employees):
            employee_skills = {}
            # 각 직원마다 3-7개 스킬을 랜덤하게 선택
            selected_skills = random.sample(skills, random.randint(3, 7))
            for skill in selected_skills:
                # 스킬 숙련도는 정규분포를 따름 (평균 6, 표준편차 2)
                proficiency = max(1, min(10, np.random.normal(6, 2)))
                employee_skills[skill] = proficiency
            
            employee = Employee(
                id=f"EMP_{i:03d}",
                name=f"Employee_{i:03d}",
                skills=employee_skills,
                experience_years=max(0, np.random.exponential(5)),
                department=random.choice(departments),
                availability=random.uniform(0.3, 1.0),
                workload=random.uniform(0.0, 0.8)
            )
            self.employees.append(employee)
        
        # 태스크 데이터 생성
        for i in range(num_tasks):
            required_skills = {}
            # 각 태스크마다 2-5개 스킬 요구
            selected_skills = random.sample(skills, random.randint(2, 5))
            for skill in selected_skills:
                required_level = random.uniform(3, 9)
                required_skills[skill] = required_level
            
            task = Task(
                id=f"TASK_{i:03d}",
                title=f"Task_{i:03d}",
                required_skills=required_skills,
                estimated_hours=random.uniform(8, 120),
                priority=random.randint(1, 10),
                deadline_days=random.randint(1, 30),
                complexity=random.uniform(0.2, 1.0)
            )
            self.tasks.append(task)
    
    def calculate_skill_match_score(self, employee: Employee, task: Task) -> Tuple[float, Dict[str, float]]:
        """스킬 매칭 점수 계산 (수학적 모델)"""
        skill_scores = {}
        total_weight = 0
        weighted_score = 0
        
        for skill, required_level in task.required_skills.items():
            employee_level = employee.skills.get(skill, 0)
            
            # 가중치: 요구 레벨이 높을수록 중요
            weight = required_level / 10.0
            total_weight += weight
            
            # 스킬 매칭 점수 계산 (시그모이드 함수 사용)
            if employee_level == 0:
                skill_score = 0
            else:
                # 직원 레벨이 요구 레벨보다 높으면 보너스, 낮으면 페널티
                diff = employee_level - required_level
                skill_score = 1 / (1 + np.exp(-diff))  # 시그모이드 함수
            
            skill_scores[skill] = skill_score
            weighted_score += skill_score * weight
        
        if total_weight == 0:
            return 0, skill_scores
        
        final_score = weighted_score / total_weight
        return final_score, skill_scores
    
    def calculate_availability_score(self, employee: Employee, task: Task) -> float:
        """가용성 점수 계산"""
        # 현재 워크로드와 태스크 예상 시간을 고려
        available_capacity = employee.availability * (1 - employee.workload)
        required_capacity = min(1.0, task.estimated_hours / 160)  # 월 160시간 기준
        
        if available_capacity >= required_capacity:
            return 1.0
        else:
            return available_capacity / required_capacity
    
    def calculate_experience_score(self, employee: Employee, task: Task) -> float:
        """경험 점수 계산"""
        # 복잡도에 따른 필요 경험년수 계산
        required_experience = task.complexity * 10  # 0-10년
        
        if employee.experience_years >= required_experience:
            return 1.0
        else:
            # 경험 부족 시 점진적 감소
            return employee.experience_years / required_experience
    
    def calculate_priority_urgency_score(self, task: Task) -> float:
        """우선순위 및 긴급도 점수"""
        priority_score = task.priority / 10.0
        urgency_score = max(0, (30 - task.deadline_days) / 30.0)
        return (priority_score + urgency_score) / 2
    
    def calculate_match_score(self, employee: Employee, task: Task) -> MatchResult:
        """종합 매칭 점수 계산"""
        # 각 요소별 점수 계산
        skill_score, skill_breakdown = self.calculate_skill_match_score(employee, task)
        availability_score = self.calculate_availability_score(employee, task)
        experience_score = self.calculate_experience_score(employee, task)
        priority_score = self.calculate_priority_urgency_score(task)
        
        # 가중 평균 계산
        weights = {
            'skill': 0.4,
            'availability': 0.25,
            'experience': 0.2,
            'priority': 0.15
        }
        
        final_score = (
            skill_score * weights['skill'] +
            availability_score * weights['availability'] +
            experience_score * weights['experience'] +
            priority_score * weights['priority']
        )
        
        # 신뢰도 계산 (스킬 커버리지 기반)
        skill_coverage = len([s for s in task.required_skills.keys() 
                            if s in employee.skills]) / len(task.required_skills)
        confidence = skill_coverage * min(1.0, skill_score + 0.5)
        
        reasoning = {
            'skill_score': skill_score,
            'availability_score': availability_score,
            'experience_score': experience_score,
            'priority_score': priority_score,
            'skill_coverage': skill_coverage
        }
        
        return MatchResult(
            employee_id=employee.id,
            task_id=task.id,
            match_score=final_score,
            confidence=confidence,
            reasoning=reasoning
        )
    
    def run_matching_simulation(self) -> pd.DataFrame:
        """전체 매칭 시뮬레이션 실행"""
        results = []
        
        for task in self.tasks:
            task_matches = []
            for employee in self.employees:
                match_result = self.calculate_match_score(employee, task)
                task_matches.append(match_result)
            
            # 점수 순으로 정렬
            task_matches.sort(key=lambda x: x.match_score, reverse=True)
            
            # 상위 5명 저장
            for i, match in enumerate(task_matches[:5]):
                results.append({
                    'task_id': task.id,
                    'employee_id': match.employee_id,
                    'rank': i + 1,
                    'match_score': match.match_score,
                    'confidence': match.confidence,
                    'skill_score': match.reasoning['skill_score'],
                    'availability_score': match.reasoning['availability_score'],
                    'experience_score': match.reasoning['experience_score'],
                    'priority_score': match.reasoning['priority_score'],
                    'task_priority': task.priority,
                    'task_complexity': task.complexity,
                    'task_estimated_hours': task.estimated_hours
                })
        
        return pd.DataFrame(results)
    
    def statistical_analysis(self, results_df: pd.DataFrame) -> Dict:
        """통계적 분석"""
        stats_summary = {
            'match_score_stats': {
                'mean': results_df['match_score'].mean(),
                'std': results_df['match_score'].std(),
                'min': results_df['match_score'].min(),
                'max': results_df['match_score'].max(),
                'q25': results_df['match_score'].quantile(0.25),
                'q75': results_df['match_score'].quantile(0.75)
            },
            'confidence_stats': {
                'mean': results_df['confidence'].mean(),
                'std': results_df['confidence'].std(),
                'high_confidence_ratio': (results_df['confidence'] > 0.8).mean()
            },
            'correlation_analysis': {
                'skill_vs_match': results_df['skill_score'].corr(results_df['match_score']),
                'experience_vs_match': results_df['experience_score'].corr(results_df['match_score']),
                'availability_vs_match': results_df['availability_score'].corr(results_df['match_score'])
            }
        }
        
        return stats_summary

def run_mathematical_verification():
    """수학적 검증 실행"""
    print("🔬 HCM 매칭 알고리즘 수학적 검증 시작...")
    
    # 시뮬레이터 초기화
    simulator = HCMMatchingSimulator()
    
    # 다양한 규모로 테스트
    test_scenarios = [
        {'employees': 50, 'tasks': 25, 'name': 'Small Scale'},
        {'employees': 100, 'tasks': 50, 'name': 'Medium Scale'},
        {'employees': 200, 'tasks': 100, 'name': 'Large Scale'}
    ]
    
    all_results = []
    
    for scenario in test_scenarios:
        print(f"\n📊 {scenario['name']} 시나리오 실행...")
        print(f"   직원 수: {scenario['employees']}, 태스크 수: {scenario['tasks']}")
        
        # 데이터 생성
        simulator.generate_sample_data(scenario['employees'], scenario['tasks'])
        
        # 시뮬레이션 실행
        results_df = simulator.run_matching_simulation()
        results_df['scenario'] = scenario['name']
        all_results.append(results_df)
        
        # 통계 분석
        stats = simulator.statistical_analysis(results_df)
        
        print(f"   평균 매칭 점수: {stats['match_score_stats']['mean']:.3f}")
        print(f"   고신뢰도 매칭 비율: {stats['confidence_stats']['high_confidence_ratio']:.1%}")
        print(f"   스킬-매칭 상관관계: {stats['correlation_analysis']['skill_vs_match']:.3f}")
    
    # 전체 결과 병합
    combined_results = pd.concat(all_results, ignore_index=True)
    
    # 결과 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"./test-results/matching_verification_{timestamp}.csv"
    combined_results.to_csv(results_file, index=False, encoding='utf-8-sig')
    
    print(f"\n✅ 검증 완료! 결과 저장: {results_file}")
    
    return combined_results

def create_visualization_plots(results_df: pd.DataFrame):
    """시각화 생성"""
    plt.style.use('default')
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('HCM 매칭 알고리즘 성능 분석', fontsize=16, fontweight='bold')
    
    # 1. 매칭 점수 분포
    axes[0, 0].hist(results_df['match_score'], bins=30, alpha=0.7, color='skyblue', edgecolor='black')
    axes[0, 0].set_title('매칭 점수 분포')
    axes[0, 0].set_xlabel('매칭 점수')
    axes[0, 0].set_ylabel('빈도')
    axes[0, 0].axvline(results_df['match_score'].mean(), color='red', linestyle='--', 
                      label=f'평균: {results_df["match_score"].mean():.3f}')
    axes[0, 0].legend()
    
    # 2. 신뢰도 vs 매칭 점수
    axes[0, 1].scatter(results_df['confidence'], results_df['match_score'], alpha=0.6, color='green')
    axes[0, 1].set_title('신뢰도 vs 매칭 점수')
    axes[0, 1].set_xlabel('신뢰도')
    axes[0, 1].set_ylabel('매칭 점수')
    
    # 회귀선 추가
    z = np.polyfit(results_df['confidence'], results_df['match_score'], 1)
    p = np.poly1d(z)
    axes[0, 1].plot(results_df['confidence'], p(results_df['confidence']), "r--", alpha=0.8)
    
    # 3. 태스크 복잡도별 매칭 성능
    complexity_bins = pd.cut(results_df['task_complexity'], bins=5, labels=['Very Low', 'Low', 'Medium', 'High', 'Very High'])
    complexity_scores = results_df.groupby(complexity_bins)['match_score'].mean()
    axes[0, 2].bar(range(len(complexity_scores)), complexity_scores.values, color='orange', alpha=0.7)
    axes[0, 2].set_title('태스크 복잡도별 평균 매칭 점수')
    axes[0, 2].set_xlabel('복잡도')
    axes[0, 2].set_ylabel('평균 매칭 점수')
    axes[0, 2].set_xticks(range(len(complexity_scores)))
    axes[0, 2].set_xticklabels(complexity_scores.index, rotation=45)
    
    # 4. 우선순위별 성능
    priority_groups = results_df.groupby('task_priority')['match_score'].mean()
    axes[1, 0].plot(priority_groups.index, priority_groups.values, marker='o', linewidth=2, markersize=6, color='purple')
    axes[1, 0].set_title('태스크 우선순위별 평균 매칭 점수')
    axes[1, 0].set_xlabel('우선순위')
    axes[1, 0].set_ylabel('평균 매칭 점수')
    axes[1, 0].grid(True, alpha=0.3)
    
    # 5. 각 요소별 기여도
    factors = ['skill_score', 'availability_score', 'experience_score', 'priority_score']
    factor_means = [results_df[factor].mean() for factor in factors]
    factor_labels = ['스킬', '가용성', '경험', '우선순위']
    
    axes[1, 1].bar(factor_labels, factor_means, color=['red', 'blue', 'green', 'orange'], alpha=0.7)
    axes[1, 1].set_title('매칭 요소별 평균 점수')
    axes[1, 1].set_ylabel('평균 점수')
    axes[1, 1].tick_params(axis='x', rotation=45)
    
    # 6. 순위별 점수 분포
    rank_scores = results_df.groupby('rank')['match_score'].mean()
    axes[1, 2].bar(rank_scores.index, rank_scores.values, color='teal', alpha=0.7)
    axes[1, 2].set_title('순위별 평균 매칭 점수')
    axes[1, 2].set_xlabel('순위')
    axes[1, 2].set_ylabel('평균 매칭 점수')
    
    plt.tight_layout()
    
    # 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    plot_file = f"./test-results/matching_analysis_{timestamp}.png"
    plt.savefig(plot_file, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"📊 시각화 저장: {plot_file}")

if __name__ == "__main__":
    # 결과 디렉토리 생성
    import os
    os.makedirs("./test-results", exist_ok=True)
    
    # 수학적 검증 실행
    results = run_mathematical_verification()
    
    # 시각화 생성
    create_visualization_plots(results)
    
    print("\n🎉 수학적 검증 및 시각화 완료!")
    print("📁 결과 파일들이 ./test-results/ 디렉토리에 저장되었습니다.")
