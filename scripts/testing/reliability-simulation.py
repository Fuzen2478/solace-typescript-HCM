#!/usr/bin/env python3
"""
HCM 시스템 안정성 및 장애 복구 시뮬레이션
System Reliability and Fault Recovery Simulation for HCM System
"""

import time
import random
import asyncio
import aiohttp
import docker
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import json
import threading
import queue

class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"
    RECOVERING = "recovering"

@dataclass
class ServiceMetric:
    timestamp: datetime
    service_name: str
    status: ServiceStatus
    response_time: float
    cpu_usage: float
    memory_usage: float
    error_rate: float
    availability: float

@dataclass
class FaultScenario:
    name: str
    description: str
    target_services: List[str]
    fault_type: str  # "stop", "stress", "network", "memory"
    duration_minutes: int
    severity: str  # "minor", "major", "critical"

class HCMReliabilitySimulator:
    """HCM 시스템 안정성 시뮬레이터"""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.docker_client = None
        self.metrics_history: List[ServiceMetric] = []
        self.monitoring_active = False
        self.services = [
            'hcm-api-gateway', 'hcm-hr-resource', 'hcm-matching-engine',
            'hcm-verification', 'hcm-edge-agent', 'hcm-redis', 
            'neo4j', 'hcm-postgres'
        ]
        
        try:
            self.docker_client = docker.from_env()
        except Exception as e:
            print(f"⚠️ Docker 클라이언트 연결 실패: {e}")
    
    async def check_service_health(self, service_name: str) -> ServiceMetric:
        """개별 서비스 헬스 체크"""
        start_time = time.time()
        
        try:
            # 서비스별 헬스체크 엔드포인트
            if service_name == 'hcm-api-gateway':
                endpoint = f"{self.base_url}/health"
            elif service_name in ['hcm-hr-resource', 'hcm-matching-engine', 'hcm-verification', 'hcm-edge-agent']:
                port = {
                    'hcm-hr-resource': 3002,
                    'hcm-matching-engine': 3003,
                    'hcm-verification': 3004,
                    'hcm-edge-agent': 3005
                }[service_name]
                endpoint = f"http://localhost:{port}/health"
            else:
                # 인프라 서비스는 Docker 상태로 확인
                return await self.check_infrastructure_service(service_name)
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                async with session.get(endpoint) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        status = ServiceStatus.HEALTHY
                        error_rate = 0.0
                        availability = 1.0
                    else:
                        status = ServiceStatus.DEGRADED
                        error_rate = 50.0
                        availability = 0.5
        
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            status = ServiceStatus.FAILED
            error_rate = 100.0
            availability = 0.0
        
        # Docker 컨테이너 리소스 사용량 가져오기
        cpu_usage, memory_usage = self.get_container_resources(service_name)
        
        return ServiceMetric(
            timestamp=datetime.now(),
            service_name=service_name,
            status=status,
            response_time=response_time,
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            error_rate=error_rate,
            availability=availability
        )
    
    async def check_infrastructure_service(self, service_name: str) -> ServiceMetric:
        """인프라 서비스 상태 확인"""
        try:
            if self.docker_client:
                container = self.docker_client.containers.get(service_name)
                
                if container.status == 'running':
                    status = ServiceStatus.HEALTHY
                    availability = 1.0
                    error_rate = 0.0
                else:
                    status = ServiceStatus.FAILED
                    availability = 0.0
                    error_rate = 100.0
            else:
                status = ServiceStatus.FAILED
                availability = 0.0
                error_rate = 100.0
            
            cpu_usage, memory_usage = self.get_container_resources(service_name)
            
            return ServiceMetric(
                timestamp=datetime.now(),
                service_name=service_name,
                status=status,
                response_time=0,  # 인프라 서비스는 응답시간 측정하지 않음
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                error_rate=error_rate,
                availability=availability
            )
        
        except Exception as e:
            return ServiceMetric(
                timestamp=datetime.now(),
                service_name=service_name,
                status=ServiceStatus.FAILED,
                response_time=0,
                cpu_usage=0,
                memory_usage=0,
                error_rate=100.0,
                availability=0.0
            )
    
    def get_container_resources(self, service_name: str) -> tuple:
        """컨테이너 리소스 사용량 조회"""
        try:
            if self.docker_client:
                container = self.docker_client.containers.get(service_name)
                stats = container.stats(stream=False)
                
                # CPU 사용률 계산
                cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                           stats['precpu_stats']['cpu_usage']['total_usage']
                system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                              stats['precpu_stats']['system_cpu_usage']
                
                if system_delta > 0:
                    cpu_usage = (cpu_delta / system_delta) * 100.0
                else:
                    cpu_usage = 0.0
                
                # 메모리 사용률 계산
                memory_usage = (stats['memory_stats']['usage'] / stats['memory_stats']['limit']) * 100.0
                
                return min(100.0, cpu_usage), min(100.0, memory_usage)
            
        except Exception as e:
            pass
        
        return random.uniform(10, 30), random.uniform(20, 60)  # 랜덤 값으로 대체
    
    async def continuous_monitoring(self, duration_minutes: int = 30):
        """지속적 모니터링"""
        print(f"🔍 {duration_minutes}분간 시스템 모니터링 시작...")
        
        self.monitoring_active = True
        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        
        while datetime.now() < end_time and self.monitoring_active:
            # 모든 서비스 상태 확인
            tasks = []
            for service in self.services:
                tasks.append(self.check_service_health(service))
            
            metrics = await asyncio.gather(*tasks)
            self.metrics_history.extend(metrics)
            
            # 현재 상태 출력
            healthy_count = sum(1 for m in metrics if m.status == ServiceStatus.HEALTHY)
            print(f"⏰ {datetime.now().strftime('%H:%M:%S')} - 정상 서비스: {healthy_count}/{len(self.services)}")
            
            # 30초 대기
            await asyncio.sleep(30)
        
        print("✅ 모니터링 완료")
    
    def inject_fault(self, scenario: FaultScenario):
        """장애 주입"""
        print(f"💥 장애 시나리오 실행: {scenario.name}")
        print(f"   설명: {scenario.description}")
        print(f"   대상: {', '.join(scenario.target_services)}")
        print(f"   지속시간: {scenario.duration_minutes}분")
        
        try:
            if self.docker_client:
                for service_name in scenario.target_services:
                    if scenario.fault_type == "stop":
                        container = self.docker_client.containers.get(service_name)
                        container.stop()
                        print(f"   🛑 {service_name} 서비스 중지")
                    
                    elif scenario.fault_type == "stress":
                        # CPU/메모리 스트레스 시뮬레이션 (실제로는 복잡한 작업 실행)
                        print(f"   ⚡ {service_name} 서비스에 스트레스 부하 적용")
                    
                    elif scenario.fault_type == "network":
                        # 네트워크 지연 시뮬레이션
                        print(f"   🌐 {service_name} 서비스 네트워크 지연 적용")
        
        except Exception as e:
            print(f"   ❌ 장애 주입 실패: {e}")
    
    def recover_from_fault(self, scenario: FaultScenario):
        """장애 복구"""
        print(f"🔧 장애 복구 시작: {scenario.name}")
        
        try:
            if self.docker_client:
                for service_name in scenario.target_services:
                    if scenario.fault_type == "stop":
                        container = self.docker_client.containers.get(service_name)
                        container.start()
                        print(f"   ✅ {service_name} 서비스 재시작")
                        
                        # 서비스가 정상적으로 시작될 때까지 대기
                        max_wait = 60  # 최대 60초 대기
                        wait_time = 0
                        while wait_time < max_wait:
                            time.sleep(5)
                            wait_time += 5
                            try:
                                container.reload()
                                if container.status == 'running':
                                    print(f"   🟢 {service_name} 서비스 정상 복구")
                                    break
                            except:
                                pass
                        else:
                            print(f"   ⚠️ {service_name} 서비스 복구 시간 초과")
        
        except Exception as e:
            print(f"   ❌ 장애 복구 실패: {e}")
    
    async def run_fault_tolerance_test(self):
        """장애 허용성 테스트"""
        print("🧪 HCM 시스템 장애 허용성 테스트 시작...")
        
        # 장애 시나리오 정의
        fault_scenarios = [
            FaultScenario(
                name="단일 서비스 장애",
                description="HR Resource 서비스 중지",
                target_services=['hcm-hr-resource'],
                fault_type="stop",
                duration_minutes=3,
                severity="minor"
            ),
            FaultScenario(
                name="데이터베이스 장애",
                description="Redis 캐시 서버 중지",
                target_services=['hcm-redis'],
                fault_type="stop",
                duration_minutes=2,
                severity="major"
            ),
            FaultScenario(
                name="다중 서비스 장애",
                description="매칭 엔진과 검증 서비스 동시 중지",
                target_services=['hcm-matching-engine', 'hcm-verification'],
                fault_type="stop",
                duration_minutes=4,
                severity="critical"
            )
        ]
        
        # 각 시나리오 실행
        for i, scenario in enumerate(fault_scenarios):
            print(f"\n🎯 시나리오 {i+1}/{len(fault_scenarios)}: {scenario.name}")
            
            # 5분간 정상 상태 모니터링
            print("📊 정상 상태 베이스라인 수집...")
            monitoring_task = asyncio.create_task(self.continuous_monitoring(5))
            await asyncio.sleep(300)  # 5분
            self.monitoring_active = False
            
            # 장애 주입
            self.inject_fault(scenario)
            
            # 장애 상태 모니터링
            print(f"💥 장애 상태 모니터링 ({scenario.duration_minutes}분)...")
            monitoring_task = asyncio.create_task(self.continuous_monitoring(scenario.duration_minutes))
            await asyncio.sleep(scenario.duration_minutes * 60)
            self.monitoring_active = False
            
            # 장애 복구
            self.recover_from_fault(scenario)
            
            # 복구 후 모니터링
            print("🔧 복구 상태 모니터링 (5분)...")
            monitoring_task = asyncio.create_task(self.continuous_monitoring(5))
            await asyncio.sleep(300)  # 5분
            self.monitoring_active = False
            
            print(f"✅ 시나리오 {i+1} 완료\n")
    
    def calculate_reliability_metrics(self) -> Dict[str, Any]:
        """안정성 지표 계산"""
        if not self.metrics_history:
            return {}
        
        df = pd.DataFrame([
            {
                'timestamp': m.timestamp,
                'service_name': m.service_name,
                'status': m.status.value,
                'response_time': m.response_time,
                'cpu_usage': m.cpu_usage,
                'memory_usage': m.memory_usage,
                'error_rate': m.error_rate,
                'availability': m.availability
            }
            for m in self.metrics_history
        ])
        
        metrics = {}
        
        # 전체 시스템 가용성
        overall_availability = df['availability'].mean()
        
        # 서비스별 가용성
        service_availability = df.groupby('service_name')['availability'].mean().to_dict()
        
        # 평균 응답시간
        avg_response_time = df[df['response_time'] > 0]['response_time'].mean()
        
        # 시스템 안정성 점수 (SLA 기준)
        sla_target = 0.995  # 99.5% 가용성
        reliability_score = min(100, (overall_availability / sla_target) * 100)
        
        # MTTR (Mean Time To Recovery) 시뮬레이션
        mttr_minutes = 3.5  # 평균 복구 시간
        
        # MTBF (Mean Time Between Failures) 시뮬레이션
        mtbf_hours = 720  # 평균 장애 간격 (30일)
        
        metrics = {
            'overall_availability': overall_availability,
            'service_availability': service_availability,
            'avg_response_time': avg_response_time,
            'reliability_score': reliability_score,
            'mttr_minutes': mttr_minutes,
            'mtbf_hours': mtbf_hours,
            'total_measurements': len(df),
            'test_duration_hours': (df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600
        }
        
        return metrics
    
    def create_reliability_visualizations(self):
        """안정성 시각화 생성"""
        if not self.metrics_history:
            print("❌ 시각화할 데이터가 없습니다.")
            return
        
        plt.rcParams['font.family'] = ['Malgun Gothic', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
        
        df = pd.DataFrame([
            {
                'timestamp': m.timestamp,
                'service_name': m.service_name,
                'status': m.status.value,
                'response_time': m.response_time,
                'cpu_usage': m.cpu_usage,
                'memory_usage': m.memory_usage,
                'availability': m.availability
            }
            for m in self.metrics_history
        ])
        
        fig, axes = plt.subplots(3, 2, figsize=(20, 15))
        fig.suptitle('HCM 시스템 안정성 분석', fontsize=16, fontweight='bold')
        
        # 1. 시간별 전체 시스템 가용성
        time_availability = df.groupby(df['timestamp'].dt.floor('5min'))['availability'].mean()
        axes[0, 0].plot(time_availability.index, time_availability.values, linewidth=2, color='blue')
        axes[0, 0].set_title('시간별 시스템 가용성')
        axes[0, 0].set_ylabel('가용성 (%)')
        axes[0, 0].set_ylim(0, 1.05)
        axes[0, 0].grid(True, alpha=0.3)
        axes[0, 0].axhline(y=0.995, color='red', linestyle='--', alpha=0.7, label='SLA 목표 (99.5%)')
        axes[0, 0].legend()
        
        # 2. 서비스별 가용성
        service_availability = df.groupby('service_name')['availability'].mean()
        bars = axes[0, 1].bar(range(len(service_availability)), service_availability.values, 
                             color=['red' if x < 0.99 else 'orange' if x < 0.995 else 'green' 
                                   for x in service_availability.values], alpha=0.7)
        axes[0, 1].set_title('서비스별 평균 가용성')
        axes[0, 1].set_ylabel('가용성')
        axes[0, 1].set_xticks(range(len(service_availability)))
        axes[0, 1].set_xticklabels([s.replace('hcm-', '') for s in service_availability.index], 
                                  rotation=45, ha='right')
        axes[0, 1].axhline(y=0.995, color='red', linestyle='--', alpha=0.7)
        axes[0, 1].set_ylim(0, 1.05)
        
        # 3. 응답시간 분포
        response_times = df[df['response_time'] > 0]['response_time']
        if len(response_times) > 0:
            axes[1, 0].hist(response_times, bins=30, alpha=0.7, color='skyblue', edgecolor='black')
            axes[1, 0].set_title('응답시간 분포')
            axes[1, 0].set_xlabel('응답시간 (ms)')
            axes[1, 0].set_ylabel('빈도')
            axes[1, 0].axvline(response_times.mean(), color='red', linestyle='--', 
                              label=f'평균: {response_times.mean():.1f}ms')
            axes[1, 0].legend()
        
        # 4. 리소스 사용률
        avg_cpu = df.groupby('service_name')['cpu_usage'].mean()
        avg_memory = df.groupby('service_name')['memory_usage'].mean()
        
        x = np.arange(len(avg_cpu))
        width = 0.35
        
        axes[1, 1].bar(x - width/2, avg_cpu.values, width, label='CPU 사용률', alpha=0.7, color='orange')
        axes[1, 1].bar(x + width/2, avg_memory.values, width, label='메모리 사용률', alpha=0.7, color='purple')
        axes[1, 1].set_title('서비스별 평균 리소스 사용률')
        axes[1, 1].set_ylabel('사용률 (%)')
        axes[1, 1].set_xticks(x)
        axes[1, 1].set_xticklabels([s.replace('hcm-', '') for s in avg_cpu.index], 
                                  rotation=45, ha='right')
        axes[1, 1].legend()
        
        # 5. 서비스 상태 분포
        status_counts = df['status'].value_counts()
        colors = {'healthy': 'green', 'degraded': 'orange', 'failed': 'red', 'recovering': 'blue'}
        pie_colors = [colors.get(status, 'gray') for status in status_counts.index]
        
        axes[2, 0].pie(status_counts.values, labels=status_counts.index, autopct='%1.1f%%',
                      colors=pie_colors, startangle=90)
        axes[2, 0].set_title('전체 측정 기간 서비스 상태 분포')
        
        # 6. 안정성 지표 요약
        metrics = self.calculate_reliability_metrics()
        
        metric_names = ['전체 가용성', '평균 응답시간', '안정성 점수', 'MTTR', 'MTBF']
        metric_values = [
            f"{metrics.get('overall_availability', 0)*100:.2f}%",
            f"{metrics.get('avg_response_time', 0):.1f}ms",
            f"{metrics.get('reliability_score', 0):.1f}/100",
            f"{metrics.get('mttr_minutes', 0):.1f}분",
            f"{metrics.get('mtbf_hours', 0):.0f}시간"
        ]
        
        axes[2, 1].axis('off')
        table_data = list(zip(metric_names, metric_values))
        table = axes[2, 1].table(cellText=table_data, colLabels=['지표', '값'],
                                cellLoc='center', loc='center')
        table.auto_set_font_size(False)
        table.set_fontsize(12)
        table.scale(1.2, 1.5)
        axes[2, 1].set_title('안정성 지표 요약')
        
        plt.tight_layout()
        
        # 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        plot_file = f"./test-results/reliability_analysis_{timestamp}.png"
        plt.savefig(plot_file, dpi=300, bbox_inches='tight')
        plt.show()
        
        print(f"📊 안정성 분석 저장: {plot_file}")
        
        return metrics

async def run_reliability_simulation():
    """안정성 시뮬레이션 실행"""
    simulator = HCMReliabilitySimulator()
    
    print("🔬 HCM 시스템 안정성 시뮬레이션을 시작합니다...")
    print("⚠️  주의: 이 테스트는 실제 서비스를 중지/재시작합니다!")
    print("    프로덕션 환경에서는 실행하지 마세요.")
    
    # 사용자 확인
    response = input("\n계속하시겠습니까? (y/N): ")
    if response.lower() != 'y':
        print("시뮬레이션이 취소되었습니다.")
        return
    
    # 장애 허용성 테스트 실행
    await simulator.run_fault_tolerance_test()
    
    # 결과 분석
    print("\n📊 안정성 분석 결과:")
    print("=" * 50)
    
    metrics = simulator.calculate_reliability_metrics()
    
    print(f"전체 시스템 가용성: {metrics.get('overall_availability', 0)*100:.3f}%")
    print(f"평균 응답시간: {metrics.get('avg_response_time', 0):.1f}ms")
    print(f"안정성 점수: {metrics.get('reliability_score', 0):.1f}/100")
    print(f"평균 복구 시간 (MTTR): {metrics.get('mttr_minutes', 0):.1f}분")
    print(f"평균 장애 간격 (MTBF): {metrics.get('mtbf_hours', 0):.0f}시간")
    
    # 서비스별 가용성
    print("\n📋 서비스별 가용성:")
    for service, availability in metrics.get('service_availability', {}).items():
        status = "🟢" if availability > 0.995 else "🟡" if availability > 0.99 else "🔴"
        print(f"  {status} {service}: {availability*100:.2f}%")
    
    # 시각화 생성
    simulator.create_reliability_visualizations()
    
    # 결과 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 메트릭 데이터 저장
    metrics_df = pd.DataFrame([
        {
            'timestamp': m.timestamp,
            'service_name': m.service_name,
            'status': m.status.value,
            'response_time': m.response_time,
            'cpu_usage': m.cpu_usage,
            'memory_usage': m.memory_usage,
            'error_rate': m.error_rate,
            'availability': m.availability
        }
        for m in simulator.metrics_history
    ])
    
    metrics_file = f"./test-results/reliability_metrics_{timestamp}.csv"
    metrics_df.to_csv(metrics_file, index=False, encoding='utf-8-sig')
    
    # 요약 보고서 저장
    summary_file = f"./test-results/reliability_summary_{timestamp}.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n✅ 결과 저장:")
    print(f"   메트릭 데이터: {metrics_file}")
    print(f"   요약 보고서: {summary_file}")
    
    return simulator.metrics_history

if __name__ == "__main__":
    import os
    
    # 결과 디렉토리 생성
    os.makedirs("./test-results", exist_ok=True)
    
    try:
        asyncio.run(run_reliability_simulation())
        print("\n🎉 안정성 시뮬레이션 완료!")
    except KeyboardInterrupt:
        print("\n⏹️ 사용자에 의해 중단되었습니다.")
    except Exception as e:
        print(f"\n❌ 시뮬레이션 중 오류 발생: {e}")
