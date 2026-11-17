import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from functools import partial
from http.server import ThreadingHTTPServer
import io
import json
import tempfile
import threading
import unittest
from urllib.request import urlopen, Request
from urllib.error import HTTPError

from app import Handler, connect, initialize, snapshot


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = self.temp.name+'/test.sqlite3'
        initialize(self.path)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, db_path=self.path))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def get(self):
        with urlopen(self.base+'/api/inventory') as response:
            return json.load(response)

    def post(self, action, **payload):
        request = Request(self.base+'/api/'+action, json.dumps(payload).encode(), {'Content-Type':'application/json'})
        try:
            with urlopen(request) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_sample_and_idempotent_initialization(self):
        initialize(self.path)
        data = self.get()
        self.assertEqual(len(data['machines']), 2)
        self.assertEqual(len(data['products']), 12)
        self.assertTrue(any(p['low_stock'] for p in data['products']))
        self.assertTrue(any(p['expiration_status']=='expired' for p in data['products']))

    def test_sale_persists_and_rejects_overselling(self):
        status, data = self.post('sales', product_id=1, quantity=2)
        self.assertEqual(status, 200)
        self.assertEqual(data['products'][0]['quantity'], 4)
        self.assertEqual(data['today_revenue_cents'], 350)
        self.assertEqual(data['today_units'], 2)
        self.assertEqual(self.get()['sales'][0]['quantity'], 2)
        self.assertEqual(self.post('sales', product_id=1, quantity=5)[0], 400)
        self.assertEqual(self.get()['products'][0]['quantity'], 4)
        self.assertEqual(len(self.get()['sales']), 1)

    def test_invalid_sales_and_expired_batch(self):
        for quantity in [0, -1, 1.5, True, '2']:
            self.assertEqual(self.post('sales', product_id=1, quantity=quantity)[0], 400)
        self.assertEqual(self.post('sales', product_id=999, quantity=1)[0], 400)
        self.assertEqual(self.post('sales', product_id=12, quantity=1)[0], 400)

    def test_concurrent_sales_cannot_oversell(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.post('sales', product_id=1, quantity=4), range(2)))
        self.assertEqual(sorted(status for status, _ in results), [200, 400])
        data = self.get()
        self.assertEqual(data['products'][0]['quantity'], 2)
        self.assertEqual(data['today_units'], 4)

    def test_restock_and_replace(self):
        self.assertEqual(self.post('restock', product_id=1, quantity=19)[0], 400)
        status, data = self.post('restock', product_id=1, quantity=18)
        self.assertEqual(status, 200)
        self.assertEqual(data['products'][0]['quantity'], 24)
        self.assertFalse(data['products'][0]['low_stock'])
        self.assertEqual(self.post('restock', product_id=12, quantity=2)[0], 400)
        status, data = self.post('replace', product_id=12, quantity=24, expires=(date.today()+timedelta(days=60)).isoformat())
        self.assertEqual(status, 200)
        replaced = next(p for p in data['products'] if p['id'] == 12)
        self.assertEqual(replaced['expiration_status'], 'fresh')
        self.assertEqual(replaced['quantity'], 24)

    def test_alert_boundaries(self):
        for days, expected in [(-1,'expired'),(0,'expiring'),(14,'expiring'),(15,'fresh')]:
            with connect(self.path) as db:
                db.execute('UPDATE products SET expires=?, quantity=threshold WHERE id=1', ((date.today()+timedelta(days=days)).isoformat(),))
            product = self.get()['products'][0]
            self.assertEqual(product['expiration_status'], expected)
            self.assertTrue(product['low_stock'])

    def test_report_and_static_app(self):
        with urlopen(self.base+'/api/restock.csv') as response:
            rows = list(csv.DictReader(io.StringIO(response.read().decode())))
        self.assertEqual(len(rows), 12)
        self.assertEqual(rows[0]['Units to add'], '18')
        self.assertEqual(next(r for r in rows if r['Product']=='Fruit Gummies')['Action'], 'Replace expired batch')
        with urlopen(self.base+'/') as response:
            self.assertIn('Stockroom', response.read().decode())


if __name__ == '__main__':
    unittest.main()
