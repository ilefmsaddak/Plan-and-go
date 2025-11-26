import subprocess
import time
import requests
import json
import os
import signal

# Kill any existing Django process
os.system('taskkill /F /IM python.exe 2>nul')
time.sleep(2)

print("Starting Django server...")
process = subprocess.Popen(['python', 'manage.py', 'runserver', '8000'], 
                          stdout=subprocess.PIPE, 
                          stderr=subprocess.PIPE)
time.sleep(5)

try:
    # Test the proxy with restaurant search
    url = 'http://localhost:8000/api/map/proxy/serpapi/?type=search&q=restaurant&ll=41.0082,28.9784&radius=5'
    print(f"Testing proxy: {url}")
    response = requests.get(url, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        places = data.get('places', [])
        print(f"Places count: {len(places)}")
        
        if places:
            print("\nFirst 3 places:")
            for i, place in enumerate(places[:3]):
                print(f"  {i+1}. {place.get('title')} - Rating: {place.get('rating')}")
                print(f"     Address: {place.get('address')}")
                print(f"     Coords: ({place.get('latitude')}, {place.get('longitude')})")
        else:
            print("No places returned")
            print(f"Response keys: {list(data.keys())}")
    else:
        print(f"Error response: {response.text[:500]}")
        
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    print("\nStopping Django server...")
    process.terminate()
    try:
        process.wait(timeout=3)
    except:
        process.kill()
