import collections
import datetime
import gzip
import io
import json
import operator
import os
import sys


def xy(a, b):
    return {'x': a - b,
            'y': b - a}

DELTA = 60 * 60
SUFFIX = '.json.gz'

os.chdir('stations2')
paths = sorted(p for p in os.listdir() if p.endswith(SUFFIX))

latest = None
start = None
stations = []
matrix = []
for path in paths:
    t = int(path[:-len(SUFFIX)])
    if latest is None or t - latest >= DELTA:
        assert latest is None or t - latest < 2 * DELTA, '{path} follows a gap of more than {delta} seconds'.format(path=path, delta=DELTA)
        with io.TextIOWrapper(gzip.open(path)) as f:
            doc = json.load(f)
        print('{t} / {x} seconds old / {n}'.format(t=datetime.datetime.fromtimestamp(t), x=t - doc['lastUpdate'], n=len(matrix)),
              file=sys.stderr)

        row = []
        for i,station in enumerate(sorted(doc['results'], key=operator.itemgetter('id'))):
            if len(stations) <= i: stations.append(station['id'])
            assert stations[i] == station['id'], '{path} contains a different set of stations: {x} vs {y}'.format(path=path, **xy({x['id'] for x in doc['results']}, set(stations)))
            row.append([station['availableBikes'], station['availableDocks']])
        assert len(row) == len(stations)
        matrix.append(row)

        latest = t

sys.stdout.write('var DATA = ')
json.dump({'start': start,
           'delta': DELTA,
           'stations': stations,
           'data': matrix},
          sys.stdout,
          separators=(',', ':'))
sys.stdout.write(';\n')
