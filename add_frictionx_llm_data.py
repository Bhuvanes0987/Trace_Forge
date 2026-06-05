"""
Add FrictionX LLM usage data to existing observability.db without deleting anything.
Keeps all existing data intact and adds new LLM metrics.
"""

import sys
import os
import datetime
import random

from backend.app.database import SessionLocal, engine, Base
from backend.app import models

# Ensure tables exist
Base.metadata.create_all(bind=engine)


def add_frictionx_llm_data():
    """Add LLM usage metrics for FrictionX to the database"""
    db = SessionLocal()
    
    try:
        # 1. Ensure FrictionX app exists
        frictionx = db.query(models.RegisteredApp).filter(
            models.RegisteredApp.name == "FrictionX"
        ).first()
        
        if not frictionx:
            print("📦 Creating FrictionX application...")
            frictionx = models.RegisteredApp(
                name="FrictionX",
                environment="PRODUCTION",
                tech_stack="Python/FastAPI/LLM",
                url="https://frictionx.excel-tek.com/",
                api_key="otel_key_frictionx_prod_01"
            )
            db.add(frictionx)
            db.commit()
            db.refresh(frictionx)
            print(f"✅ FrictionX app created (ID: {frictionx.id})")
        else:
            print(f"✅ FrictionX app found (ID: {frictionx.id})")
        
        # 2. Generate LLM usage metrics
        print("\n📊 Generating FrictionX LLM usage metrics...")
        
        now = datetime.datetime.utcnow()
        models_list = ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"]
        
        # Generate 50 LLM API call records over the last 24 hours
        num_calls = 50
        
        for i in range(num_calls):
            model_used = random.choice(models_list)
            
            # Token counts (realistic ranges)
            if "gpt-4-turbo" in model_used or "gpt-4" in model_used:
                input_tokens = random.randint(100, 2000)
                output_tokens = random.randint(50, 1500)
                cost_per_1m_input = 0.01
                cost_per_1m_output = 0.03
            elif "3.5" in model_used:
                input_tokens = random.randint(50, 1000)
                output_tokens = random.randint(30, 800)
                cost_per_1m_input = 0.0005
                cost_per_1m_output = 0.0015
            else:  # Claude models
                input_tokens = random.randint(80, 1500)
                output_tokens = random.randint(40, 1200)
                cost_per_1m_input = 0.003
                cost_per_1m_output = 0.015
            
            total_tokens = input_tokens + output_tokens
            cost_usd = (input_tokens * cost_per_1m_input / 1_000_000) + (output_tokens * cost_per_1m_output / 1_000_000)
            timestamp = now - datetime.timedelta(hours=random.randint(0, 24))
            
            # Create metrics for this LLM call
            metrics = [
                ("llm_total_tokens", total_tokens, {"model": model_used, "type": "total"}),
                ("llm_input_tokens", input_tokens, {"model": model_used, "type": "input"}),
                ("llm_output_tokens", output_tokens, {"model": model_used, "type": "output"}),
                ("llm_cost_usd", cost_usd, {"model": model_used, "currency": "USD"}),
                ("llm_response_time_ms", random.uniform(100, 3500), {"model": model_used}),
            ]
            
            for metric_name, value, labels in metrics:
                db.add(models.MetricData(
                    app_id=frictionx.id,
                    metric_name=metric_name,
                    service_name="frictionx-llm-engine",
                    value=float(value),
                    timestamp=timestamp,
                    labels=labels
                ))
            
            if (i + 1) % 10 == 0:
                print(f"  ✓ Added {i + 1}/{num_calls} LLM call metrics")
        
        # 3. Add aggregated metrics
        print("\n📈 Adding aggregated LLM metrics...")
        
        total_batch_tokens = random.randint(5000, 15000)
        total_batch_cost = (total_batch_tokens / 1_000_000) * 0.75
        
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_total_tokens_24h",
            service_name="frictionx-llm-engine",
            value=float(total_batch_tokens),
            timestamp=now,
            labels={"window": "24h", "calls": str(num_calls)}
        ))
        
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_total_cost_usd_24h",
            service_name="frictionx-llm-engine",
            value=total_batch_cost,
            timestamp=now,
            labels={"window": "24h", "currency": "USD"}
        ))
        
        # Average metrics
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_avg_response_time_ms",
            service_name="frictionx-llm-engine",
            value=random.uniform(500, 1500),
            timestamp=now,
            labels={"window": "24h"}
        ))
        
        db.commit()
        
        print("✅ Aggregated metrics added")
        
        # 4. Display summary
        print("\n" + "="*60)
        print("📊 LLM USAGE DATA ADDED TO FRICTIONX")
        print("="*60)
        print(f"Application: FrictionX (ID: {frictionx.id})")
        print(f"Metrics Added:")
        print(f"  • Total LLM calls: {num_calls}")
        print(f"  • Total tokens (24h): {total_batch_tokens:,}")
        print(f"  • Total cost (24h): ${total_batch_cost:.4f} USD")
        print(f"  • Models used: {', '.join(set(random.sample(models_list, k=min(3, len(models_list)))))}")
        print(f"\n✨ Your database is ready! The LLM Usage dashboard should now show data.")
        print("="*60)
        
    except Exception as e:
        print(f"❌ Error adding LLM data: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    add_frictionx_llm_data()
