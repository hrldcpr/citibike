import collections
import datetime
import gzip
import io
import json
import logging
import operator
import os
import sys


START = int(sys.argv[1]);
DELTA = int(sys.argv[2]) * 60
SUFFIX = '.json.gz'


def xy(a, b):
    return {'x': a - b,
            'y': b - a}

os.chdir('stations2')
paths = sorted(p for p in os.listdir() if p.endswith(SUFFIX))

latest = START - DELTA
stations = []
matrix = []
for path in paths:
    t = int(path[:-len(SUFFIX)])
    if t - latest >= DELTA:
        assert t - latest < 2 * DELTA, '{path} follows a gap of more than {delta} seconds'.format(path=path, delta=DELTA)
        latest += DELTA

        with io.TextIOWrapper(gzip.open(path)) as f:
            doc = json.load(f)
        logging.info('{t} / {x} seconds old / {n}'.format(t=datetime.datetime.fromtimestamp(t), x=t - doc['lastUpdate'], n=len(matrix)))

        row = []
        i = 0
        for station in sorted(doc['results'], key=operator.itemgetter('id')):
            while i < len(stations) and stations[i] != station['id']:
                if stations[i] > station['id']:
                    # a new station that's not at the end, so we have to fix all previous rows
                    logging.warning('{path} contains a different set of stations: {x} vs {y}'.format(path=path, **xy({x['id'] for x in doc['results']}, set(stations))))
                    stations.insert(i, station['id'])
                    for old_row in matrix:
                        old_row.insert(i, [0, 0])
                    continue
                logging.warning('{path} is missing station {id}'.format(path=path, id=station['id']))
                row.append([0, 0])
                i += 1
            if i >= len(stations): stations.append(station['id'])
            row.append([station['availableBikes'], station['availableDocks']])
            i += 1

        assert len(row) == len(stations)
        matrix.append(row)


sys.stdout.write('var DATA = ')
json.dump({'start': START,
           'delta': DELTA,
           'stations': stations,
           'data': matrix},
          sys.stdout,
          separators=(',', ':'))
sys.stdout.write(';\n')
