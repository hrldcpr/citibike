import collections
import gzip
import json
import sys


class Station(object):
    def __init__(self, id, total):
        self.id = id
        self.total = total
        self.bikes = []
        self.docks = []


WACKOS = {336, 505}

def main(minutes):
    stations = {}
    for minute in minutes:
        for station in minute['stationBeanList']:
            id = station['id']
            total = station['totalDocks']
            if id not in stations:
                stations[id] = Station(id, total)
            s = stations[id]
            if id not in WACKOS: assert s.total == total, 'totalDocks for station {id} changed from {a} to {b}!'.format(id=id, a=s.total, b=total)

            s.bikes.append(station['availableBikes'])
            s.docks.append(station['availableDocks'])

    for id,station in sorted(stations.items()):
        deltas = (station.bikes[i+1] - station.bikes[i] for i in range(len(station.bikes) - 1))
        print('%4d  %s' % (station.id,
                          ' '.join(('%+d'%d if d else '  ') for d in deltas)))

minutes = []
for path in sys.argv[1:]:
    with gzip.open(path) as f:
        data = f.read()
        if data: # skip empty files
            minutes.append(json.loads(data))
main(minutes)
