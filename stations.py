import json
import sys

import requests

KEYS = {'id', 'label', 'latitude', 'longitude'}

stations = requests.get('http://appservices.citibikenyc.com/data2/stations.php').json()['results']
stations = [{k: s[k] for k in KEYS} for s in stations]

sys.stdout.write('var STATIONS = ')
json.dump(stations, sys.stdout, separators=(',', ':'))
sys.stdout.write(';\n')
