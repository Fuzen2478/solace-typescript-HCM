#!/usr/bin/env python3
"""
HCM 시스템 성능 벤치마킹 및 시뮬레이션
Performance Benchmarking and Load Simulation for HCM System
"""

import asyncio
import aiohttp
import time
import statistics
import json
from datetime import datetime
from typing import List, Dict, Any
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from dataclasses import dataclass
import concurrent.futures
import threading

@dataclass
class BenchmarkResult:
    test_name: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    percentile_95: float
    percentile_99: float
    requests_per_second: float
    error_rate: float
    throughput_mb_per_sec: float

class HCMPerformanceBenchmark:
    """HCM 시스템 성능 벤치마킹"""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.results: List[BenchmarkResult] = []
        
    async def single_request(self, session: aiohttp.ClientSession, endpoint: str, 
                           method: str = "GET", data: Dict = None) -> Dict[str, Any]:
        """단일 요청 실행"""
        start_time = time.time()
        try:
            url = f"{self.base_url}{endpoint}"
            
            if method.upper() == "GET":
                async with session.get(url) as response:
                    response_data = await response.text()
                    status = response.status
            elif method.upper() == "POST":
                async with session.post(url, json=data) as response:
                    response_data = await response.text()
                    status = response.status
            
            end_time = time.time()
            
            return {
                'success': status == 200,
                'response_time': (end_time - start_time) * 1000,  # ms
                'status_code': status,
                'response_size': len(response_data.encode('utf-8'))
            }
            
        except Exception as e:
            end_time = time.time()
            return {
                'success': False,
                'response_time': (end_time - start_time) * 1000,
                'status_code': 0,
                'response_size': 0,
                'error': str(e)
            }
    
    async def load_test(self, endpoint: str, concurrent_users: int, 
                       total_requests: int, method: str = "GET", 
                       data: Dict = None) -> List[Dict[str, Any]]:
        """부하 테스트 실행"""
        
        semaphore = asyncio.Semaphore(concurrent_users)
        
        async def limited_request(session):
            async with semaphore:
                return await self.single_request(session, endpoint, method, data)
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=200)
        ) as session:
            
            start_time = time.time()
            
            # 요청 생성
            tasks = [limited_request(session) for _ in range(total_requests)]
            
            # 동시 실행
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            
            # 예외 처리
            valid_results = []
            for result in results:
                if isinstance(result, Exception):
                    valid_results.append({
                        'success': False,
                        'response_time': 0,
                        'status_code': 0,
                        'response_size': 0,
                        'error': str(result)
                    })
                else:
                    valid_results.append(result)
            
            # 전체 실행 시간 추가
            total_time = end_time - start_time
            for result in valid_results:
                result['total_test_time'] = total_time
            
            return valid_results
    
    def analyze_results(self, results: List[Dict[str, Any]], test_name: str) -> BenchmarkResult:
        """결과 분석"""
        if not results:
            return BenchmarkResult(
                test_name=test_name,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_response_time=0,
                min_response_time=0,
                max_response_time=0,
                percentile_95=0,
                percentile_99=0,
                requests_per_second=0,
                error_rate=0,
                throughput_mb_per_sec=0
            )
        
        successful_results = [r for r in results if r['success']]
        response_times = [r['response_time'] for r in successful_results]
        
        total_requests = len(results)
        successful_requests = len(successful_results)
        failed_requests = total_requests - successful_requests
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
            percentile_95 = np.percentile(response_times, 95)
            percentile_99 = np.percentile(response_times, 99)
        else:
            avg_response_time = min_response_time = max_response_time = 0
            percentile_95 = percentile_99 = 0
        
        # 처리량 계산
        total_time = results[0].get('total_test_time', 1)
        requests_per_second = successful_requests / total_time if total_time > 0 else 0
        
        # 에러율
        error_rate = (failed_requests / total_requests) * 100 if total_requests > 0 else 0
        
        # 데이터 처리량 (MB/s)
        total_bytes = sum(r.get('response_size', 0) for r in successful_results)
        throughput_mb_per_sec = (total_bytes / (1024 * 1024)) / total_time if total_time > 0 else 0
        
        return BenchmarkResult(
            test_name=test_name,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time=avg_response_time,
            min_response_time=min_response_time,
            max_response_time=max_response_time,
            percentile_95=percentile_95,
            percentile_99=percentile_99,
            requests_per_second=requests_per_second,
            error_rate=error_rate,
            throughput_mb_per_sec=throughput_mb_per_sec
        )
    
    async def run_comprehensive_benchmark(self):
        """종합 벤치마크 실행"""
        print("🚀 HCM 시스템 성능 벤치마킹 시작...")
        
        # 테스트 시나리오 정의
        test_scenarios = [
            {
                'name': 'Health Check - Light Load',
                'endpoint': '/health',
                'method': 'GET',
                'concurrent_users': 10,
                'total_requests': 100
            },
            {
                'name': 'Health Check - Medium Load',
                'endpoint': '/health',
                'method': 'GET',
                'concurrent_users': 50,
                'total_requests': 500
            },
            {
                'name': 'Health Check - Heavy Load',
                'endpoint': '/health',
                'method': 'GET',
                'concurrent_users': 100,
                'total_requests': 1000
            },
            {
                'name': 'Service Registry - Light Load',
                'endpoint': '/services',
                'method': 'GET',
                'concurrent_users': 10,
                'total_requests': 100
            },
            {
                'name': 'Service Registry - Heavy Load',
                'endpoint': '/services',
                'method': 'GET',
                'concurrent_users': 50,
                'total_requests': 500
            },
            {
                'name': 'Analytics Overview - Medium Load',
                'endpoint': '/analytics/overview',
                'method': 'GET',
                'concurrent_users': 20,
                'total_requests': 200
            },
            {
                'name': 'Employee Onboarding - Workflow',
                'endpoint': '/workflows/employee-onboarding',
                'method': 'POST',
                'concurrent_users': 5,
                'total_requests': 25,
                'data': {
                    'firstName': 'Test',
                    'lastName': 'Employee',
                    'email': 'test@example.com',
                    'department': 'IT',
                    'skills': [{'name': 'JavaScript', 'level': 8}]
                }
            }
        ]
        
        # 각 시나리오 실행
        for scenario in test_scenarios:
            print(f"\n📊 실행 중: {scenario['name']}")
            print(f"   동시 사용자: {scenario['concurrent_users']}")
            print(f"   총 요청 수: {scenario['total_requests']}")
            
            # 테스트 실행
            results = await self.load_test(
                endpoint=scenario['endpoint'],
                concurrent_users=scenario['concurrent_users'],
                total_requests=scenario['total_requests'],
                method=scenario['method'],
                data=scenario.get('data')
            )
            
            # 결과 분석
            benchmark_result = self.analyze_results(results, scenario['name'])
            self.results.append(benchmark_result)
            
            # 실시간 결과 출력
            print(f"   ✅ 완료 - 성공률: {(benchmark_result.successful_requests/benchmark_result.total_requests)*100:.1f}%")
            print(f"   ⚡ 평균 응답시간: {benchmark_result.avg_response_time:.1f}ms")
            print(f"   🔥 처리량: {benchmark_result.requests_per_second:.1f} req/s")
            
            # 각 테스트 사이에 잠시 대기
            await asyncio.sleep(2)
    
    def generate_performance_report(self) -> pd.DataFrame:
        """성능 보고서 생성"""
        data = []
        for result in self.results:
            data.append({
                'Test Name': result.test_name,
                'Total Requests': result.total_requests,
                'Success Rate (%)': (result.successful_requests / result.total_requests) * 100,
                'Avg Response Time (ms)': result.avg_response_time,
                '95th Percentile (ms)': result.percentile_95,
                '99th Percentile (ms)': result.percentile_99,
                'Requests/sec': result.requests_per_second,
                'Error Rate (%)': result.error_rate,
                'Throughput (MB/s)': result.throughput_mb_per_sec
            })
        
        return pd.DataFrame(data)
    
    def create_performance_visualizations(self):
        """성능 시각화 생성"""
        if not self.results:
            print("❌ 분석할 결과가 없습니다.")
            return
        
        plt.rcParams['font.family'] = ['Malgun Gothic', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
        
        fig, axes = plt.subplots(2, 3, figsize=(20, 12))
        fig.suptitle('HCM 시스템 성능 벤치마킹 결과', fontsize=16, fontweight='bold')
        
        test_names = [r.test_name for r in self.results]
        short_names = [name.split(' - ')[0] for name in test_names]
        
        # 1. 평균 응답 시간
        avg_times = [r.avg_response_time for r in self.results]
        axes[0, 0].bar(range(len(short_names)), avg_times, color='skyblue', alpha=0.7)
        axes[0, 0].set_title('평균 응답 시간 (ms)')
        axes[0, 0].set_xlabel('테스트')
        axes[0, 0].set_ylabel('응답 시간 (ms)')
        axes[0, 0].set_xticks(range(len(short_names)))
        axes[0, 0].set_xticklabels(short_names, rotation=45, ha='right')
        
        # 2. 처리량 (Requests/sec)
        throughput = [r.requests_per_second for r in self.results]
        axes[0, 1].bar(range(len(short_names)), throughput, color='green', alpha=0.7)
        axes[0, 1].set_title('처리량 (Requests/sec)')
        axes[0, 1].set_xlabel('테스트')
        axes[0, 1].set_ylabel('Requests/sec')
        axes[0, 1].set_xticks(range(len(short_names)))
        axes[0, 1].set_xticklabels(short_names, rotation=45, ha='right')
        
        # 3. 성공률
        success_rates = [(r.successful_requests / r.total_requests) * 100 for r in self.results]
        colors = ['red' if rate < 95 else 'orange' if rate < 99 else 'green' for rate in success_rates]
        axes[0, 2].bar(range(len(short_names)), success_rates, color=colors, alpha=0.7)
        axes[0, 2].set_title('성공률 (%)')
        axes[0, 2].set_xlabel('테스트')
        axes[0, 2].set_ylabel('성공률 (%)')
        axes[0, 2].set_xticks(range(len(short_names)))
        axes[0, 2].set_xticklabels(short_names, rotation=45, ha='right')
        axes[0, 2].set_ylim(0, 105)
        
        # 4. 95th vs 99th Percentile 비교
        p95 = [r.percentile_95 for r in self.results]
        p99 = [r.percentile_99 for r in self.results]
        x = np.arange(len(short_names))
        width = 0.35
        
        axes[1, 0].bar(x - width/2, p95, width, label='95th Percentile', color='orange', alpha=0.7)
        axes[1, 0].bar(x + width/2, p99, width, label='99th Percentile', color='red', alpha=0.7)
        axes[1, 0].set_title('응답 시간 백분위수 (ms)')
        axes[1, 0].set_xlabel('테스트')
        axes[1, 0].set_ylabel('응답 시간 (ms)')
        axes[1, 0].set_xticks(x)
        axes[1, 0].set_xticklabels(short_names, rotation=45, ha='right')
        axes[1, 0].legend()
        
        # 5. 에러율
        error_rates = [r.error_rate for r in self.results]
        axes[1, 1].bar(range(len(short_names)), error_rates, color='red', alpha=0.7)
        axes[1, 1].set_title('에러율 (%)')
        axes[1, 1].set_xlabel('테스트')
        axes[1, 1].set_ylabel('에러율 (%)')
        axes[1, 1].set_xticks(range(len(short_names)))
        axes[1, 1].set_xticklabels(short_names, rotation=45, ha='right')
        
        # 6. 데이터 처리량
        data_throughput = [r.throughput_mb_per_sec for r in self.results]
        axes[1, 2].bar(range(len(short_names)), data_throughput, color='purple', alpha=0.7)
        axes[1, 2].set_title('데이터 처리량 (MB/s)')
        axes[1, 2].set_xlabel('테스트')
        axes[1, 2].set_ylabel('처리량 (MB/s)')
        axes[1, 2].set_xticks(range(len(short_names)))
        axes[1, 2].set_xticklabels(short_names, rotation=45, ha='right')
        
        plt.tight_layout()
        
        # 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        plot_file = f"./test-results/performance_benchmark_{timestamp}.png"
        plt.savefig(plot_file, dpi=300, bbox_inches='tight')
        plt.show()
        
        print(f"📊 성능 시각화 저장: {plot_file}")

async def run_performance_benchmark():
    """성능 벤치마크 실행"""
    benchmark = HCMPerformanceBenchmark()
    
    # 벤치마크 실행
    await benchmark.run_comprehensive_benchmark()
    
    # 결과 분석
    print("\n📊 성능 벤치마킹 완료!")
    print("=" * 50)
    
    for result in benchmark.results:
        print(f"\n🎯 {result.test_name}")
        print(f"   총 요청: {result.total_requests:,}")
        print(f"   성공률: {(result.successful_requests/result.total_requests)*100:.1f}%")
        print(f"   평균 응답시간: {result.avg_response_time:.1f}ms")
        print(f"   95th 백분위: {result.percentile_95:.1f}ms")
        print(f"   처리량: {result.requests_per_second:.1f} req/s")
        print(f"   에러율: {result.error_rate:.1f}%")
    
    # 보고서 생성
    report_df = benchmark.generate_performance_report()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = f"./test-results/performance_report_{timestamp}.csv"
    report_df.to_csv(report_file, index=False, encoding='utf-8-sig')
    
    # 시각화 생성
    benchmark.create_performance_visualizations()
    
    print(f"\n✅ 성능 보고서 저장: {report_file}")
    
    return benchmark.results

if __name__ == "__main__":
    import os
    
    # 결과 디렉토리 생성
    os.makedirs("./test-results", exist_ok=True)
    
    # 성능 벤치마크 실행
    print("🚀 HCM 시스템 성능 벤치마킹을 시작합니다...")
    print("⚠️  주의: 이 테스트를 실행하기 전에 HCM 시스템이 실행 중인지 확인하세요!")
    print("    명령어: pnpm docker:dev:all")
    
    input("\nEnter를 눌러 계속...")
    
    try:
        asyncio.run(run_performance_benchmark())
        print("\n🎉 성능 벤치마킹 완료!")
    except Exception as e:
        print(f"\n❌ 벤치마킹 중 오류 발생: {e}")
        print("💡 HCM 시스템이 실행 중인지 확인하세요: pnpm health-check")
