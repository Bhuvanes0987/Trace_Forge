import requests
import json
import sys

BASE_URL = "http://192.168.1.250:8003/api/v1/intelligence"

def run_tests():
    print("[+] Starting Enterprise Memory Fabric Platform Tests...")
    
    # 1. Seed Journey
    print("\n1. Seeding a new multi-app simulated user journey...")
    try:
        res = requests.post(f"{BASE_URL}/seed-journey")
        if res.status_code != 200:
            print(f"[-] Failed to seed journey: HTTP {res.status_code}")
            sys.exit(1)
        data = res.json()
        session_id = data["session_id"]
        user_email = data["user_email"]
        print(f"[+] Seeding successful!")
        print(f"   - Session ID: {session_id}")
        print(f"   - User Identity: {user_email}")
    except Exception as e:
        print(f"[-] Connection error to backend server: {e}")
        print("   Make sure the FastAPI server is running on http://localhost:8003")
        sys.exit(1)

    # 2. Retrieve & Synthesize Context
    print("\n2. Requesting Synthesized Context from Hot Memory...")
    res = requests.get(f"{BASE_URL}/context/{session_id}")
    if res.status_code != 200:
        print(f"[-] Failed to fetch context: HTTP {res.status_code}")
        sys.exit(1)
    context_data = res.json()
    print("[+] Context synthesis retrieval successful!")
    print(f"   - Active Context: \"{context_data['active_context']}\"")
    print(f"   - Raw Events Scanned: {context_data['raw_events_count']}")

    # 3. Query Semantic Memory
    print("\n3. Testing Semantic Memory Search (Vector Index Sim)...")
    search_payload = {"query": "checkout database pool exception", "limit": 3}
    res = requests.post(f"{BASE_URL}/query", json=search_payload)
    if res.status_code != 200:
        print(f"[-] Semantic query failed: HTTP {res.status_code}")
        sys.exit(1)
    query_data = res.json()
    print(f"[+] Semantic search successful! Found {query_data['matches_found']} relevance matches.")
    for idx, match in enumerate(query_data["results"]):
        print(f"   Match #{idx+1} [Score: {match['relevance_score']}]: Prompt: \"{match['prompt']}\" -> Resp: \"{match['response']}\"")

    # 4. Memory stats
    print("\n4. Checking Memory Fabric Tier Statistics...")
    res = requests.get(f"{BASE_URL}/memory")
    if res.status_code != 200:
        print(f"[-] Failed to fetch memory stats: HTTP {res.status_code}")
        sys.exit(1)
    stats_data = res.json()
    print("[+] Stats retrieved successfully:")
    for key, layer in stats_data["layers"].items():
        print(f"   - {layer['name']}: {layer['count']} entries ({layer['status']}) - {layer['purpose']}")

    print("\n[+] All tests passed successfully!")

if __name__ == "__main__":
    run_tests()
