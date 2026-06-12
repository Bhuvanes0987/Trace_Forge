#!/usr/bin/env python3
"""End-to-end test for backend telemetry generation."""

import sys
import os
import subprocess
import time
import requests
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

def cleanup_database():
    """Remove stale database file."""
    db_file = Path("observability.db")
    if db_file.exists():
        db_file.unlink()
        print("✅ Removed old database file")
    else:
        print("✅ No old database file found")

def test_imports():
    """Test that all modules can be imported."""
    try:
        from app import simulator, models, database, schemas
        print("✅ All imports successful")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def test_seeding():
    """Test that seeding produces expected results."""
    try:
        from app.database import SessionLocal
        from app import simulator
        
        db = SessionLocal()
        apps = simulator.seed_default_applications(db)
        simulator.seed_memory_fabric(db)
        simulator.generate_telemetry_batch(db, apps)
        
        # Query to verify data was created
        from app import models
        trace_count = db.query(models.TraceSpan).count()
        metric_count = db.query(models.MetricData).count()
        log_count = db.query(models.LogData).count()
        
        print(f"✅ Seeding successful:")
        print(f"   - Apps created: {len(apps)}")
        print(f"   - Traces: {trace_count}")
        print(f"   - Metrics: {metric_count}")
        print(f"   - Logs: {log_count}")
        
        # Check LLM data for FrictionX
        llm_count = db.query(models.MetricData).filter(
            models.MetricData.metric_name.like("%llm%")
        ).count()
        print(f"   - LLM Metrics: {llm_count}")
        
        db.close()
        return trace_count > 0 and metric_count > 0 and log_count > 0
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backend_startup():
    """Start backend server and test endpoints."""
    print("\n🚀 Starting backend server...")
    
    # Start uvicorn in background
    process = subprocess.Popen(
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"],
        cwd="backend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start
    time.sleep(3)
    
    try:
        # Test health endpoint
        response = requests.get("http://localhost:8003/health")
        if response.status_code != 200:
            print(f"❌ Health check failed: {response.status_code}")
            return False
        print("✅ Backend started successfully")
        
        # Test apps endpoint
        response = requests.get("http://localhost:8003/api/v1/apps")
        if response.status_code != 200:
            print(f"❌ Apps endpoint failed: {response.status_code}")
            return False
        apps = response.json()
        print(f"✅ Apps endpoint works ({len(apps)} apps)")
        
        # Test dashboard overview
        response = requests.get("http://localhost:8003/api/v1/dashboards/overview")
        if response.status_code != 200:
            print(f"❌ Dashboard overview failed: {response.status_code}")
            return False
        overview = response.json()
        print(f"✅ Dashboard overview: {overview}")
        
        # Test LLM usage endpoint
        response = requests.get("http://localhost:8003/api/v1/dashboards/llm-usage")
        if response.status_code != 200:
            print(f"❌ LLM usage endpoint failed: {response.status_code}")
            return False
        llm_data = response.json()
        print(f"✅ LLM usage endpoint: {len(llm_data.get('data', []))} models")
        
        return True
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        return False
    finally:
        process.terminate()
        process.wait(timeout=5)

def main():
    print("🧪 Backend E2E Test Suite\n")
    
    # Change to project directory
    os.chdir(Path(__file__).parent)
    
    # Run tests
    tests = [
        ("Cleanup database", cleanup_database),
        ("Test imports", test_imports),
        ("Test seeding", test_seeding),
        # ("Test backend startup", test_backend_startup),  # Commented for manual testing
    ]
    
    results = {}
    for name, test_func in tests:
        print(f"\n📋 {name}...")
        results[name] = test_func()
    
    # Summary
    print("\n" + "="*50)
    print("📊 Test Summary:")
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    print(f"   Passed: {passed}/{total}")
    
    for name, result in results.items():
        status = "✅" if result else "❌"
        print(f"   {status} {name}")
    
    return all(results.values())

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
