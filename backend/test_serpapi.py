import requests
import os
from dotenv import load_dotenv
import json

load_dotenv()
serpapi_key = os.getenv('SERPAPI_KEY')

print("Testing SerpApi directly...")
print(f"Key: {serpapi_key[:20]}...")

# Test 1: Search with type=search and q parameter
params = {
    'api_key': serpapi_key,
    'type': 'search',
    'q': 'restaurant near Istanbul',
    'll': '41.0082,28.9784',
    'radius': 5
}

print("\n=== Test 1: SerpApi with type=search ===")
print(f"Parameters: {params}")
response = requests.get('https://serpapi.com/search', params=params, timeout=10)
print(f"Status: {response.status_code}")
data = response.json()
print(f"Response keys: {list(data.keys())}")

if 'local_results' in data:
    print(f"✓ local_results: {len(data['local_results'])} items")
    if data['local_results']:
        print(f"First result: {data['local_results'][0]}")
else:
    print(f"✗ No local_results key")
    
if 'organic_results' in data:
    print(f"✓ organic_results: {len(data['organic_results'])} items")
else:
    print(f"✗ No organic_results key")

# Test 2: Try with engine=google_maps
print("\n=== Test 2: SerpApi with engine=google_maps ===")
params2 = {
    'api_key': serpapi_key,
    'engine': 'google_maps',
    'q': 'restaurant',
    'll': '41.0082,28.9784',
    'radius': 5000
}
print(f"Parameters: {params2}")
response2 = requests.get('https://serpapi.com/search', params=params2, timeout=10)
print(f"Status: {response2.status_code}")
data2 = response2.json()
print(f"Response keys: {list(data2.keys())}")

if 'results' in data2:
    print(f"✓ results: {len(data2['results'])} items")
    if data2['results']:
        print(f"First result keys: {list(data2['results'][0].keys())}")
        print(f"First result: {json.dumps(data2['results'][0], indent=2)[:500]}")
else:
    print(f"✗ No results key")
